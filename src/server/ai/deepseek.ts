import 'server-only';

import {
  ProviderError,
  interpretationSchema,
  narrationSchema,
  type GameMaster,
  type InterpretContext,
  type Interpretation,
  type NarrateContext,
  type Narration,
} from './types';
import {
  INTERPRETER_SYSTEM,
  NARRATOR_SYSTEM,
  INTERPRET_SCHEMA_HINT,
  NARRATION_SCHEMA_HINT,
  PROMPT_VERSION,
} from './prompts';
import { interpretUserPayload, narrateUserPayload } from './context';
import { assertInterpretation, assertNarration } from './validate';

const MAX_RESPONSE_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 25_000;

export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

type ChatRole = 'system' | 'user' | 'assistant';

type ChatRequest = {
  model: string;
  messages: Array<{ role: ChatRole; content: string }>;
  response_format: { type: 'json_object' };
  thinking: { type: 'disabled' };
  stream: false;
  temperature: number;
  max_tokens: number;
};

export function chatCompletionsUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('Invalid DEEPSEEK_BASE_URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('DEEPSEEK_BASE_URL must be http(s)');
  }
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

export function createDeepSeekMaster(config: DeepSeekConfig): GameMaster {
  const url = chatCompletionsUrl(config.baseUrl);
  const fetchImpl = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleep = config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function complete(args: {
    system: string;
    user: string;
    temperature: number;
    maxTokens: number;
    parse: (content: string) => unknown;
  }): Promise<unknown> {
    const messages: ChatRequest['messages'] = [
      { role: 'system', content: `${args.system}\nPrompt version: ${PROMPT_VERSION}` },
      { role: 'user', content: args.user },
    ];
    const body: ChatRequest = {
      model: config.model,
      messages,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      stream: false,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
    };

    const attempt = async (repairNote?: string) => {
      const payload: ChatRequest = repairNote
        ? {
            ...body,
            messages: [
              ...messages,
              {
                role: 'user',
                content: `The previous output was invalid: ${repairNote}. Return only JSON matching ${args.user.includes('"task":"narrate"') ? NARRATION_SCHEMA_HINT : INTERPRET_SCHEMA_HINT}. Do not start a new action.`,
              },
            ],
          }
        : body;
      return requestOnce(fetchImpl, url, config.apiKey, payload, timeoutMs, args.parse);
    };

    try {
      return await attempt();
    } catch (error) {
      if (!isRetryable(error)) {
        throw error;
      }
      const waitMs = retryAfterMs(error);
      if (waitMs > 2_000) {
        throw toProviderError(error);
      }
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      try {
        const note = error instanceof Error ? error.message.slice(0, 240) : 'invalid output';
        return await attempt(note);
      } catch (retryError) {
        throw toProviderError(retryError);
      }
    }
  }

  return {
    async interpret(context: InterpretContext): Promise<Interpretation> {
      const content = await complete({
        system: INTERPRETER_SYSTEM,
        user: interpretUserPayload(context),
        temperature: 0.2,
        maxTokens: 1200,
        parse: (raw) =>
          assertInterpretation(interpretationSchema.parse(parseJsonObject(raw)), context),
      });
      return content as Interpretation;
    },
    async narrate(context: NarrateContext): Promise<Narration> {
      const ending = Boolean(context.endingKind);
      const content = await complete({
        system: NARRATOR_SYSTEM,
        user: narrateUserPayload(context),
        temperature: 0.7,
        maxTokens: ending ? 2400 : 1800,
        parse: (raw) => assertNarration(narrationSchema.parse(parseJsonObject(raw)), context),
      });
      return content as Narration;
    },
  };
}

async function requestOnce(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body: ChatRequest,
  timeoutMs: number,
  parse: (content: string) => unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new ProviderError('AI_TIMEOUT', 'Provider request timed out');
    }
    throw new ProviderError('AI_UNAVAILABLE', 'Provider network failure');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('AI_UNAVAILABLE', `Provider authentication failed (${response.status})`);
  }
  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    const error = new ProviderError('AI_UNAVAILABLE', 'Provider rate limited');
    (error as ProviderError & { retryAfterMs?: number }).retryAfterMs = retryAfter;
    throw error;
  }
  if (response.status >= 500) {
    throw new ProviderError('AI_UNAVAILABLE', `Provider HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new ProviderError('AI_UNAVAILABLE', `Provider HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Provider response exceeded 128 KiB');
  }
  let envelope: {
    choices?: Array<{
      message?: { content?: string | null };
      finish_reason?: string;
    }>;
  };
  try {
    envelope = JSON.parse(buffer.toString('utf8')) as typeof envelope;
  } catch {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Provider envelope was not JSON');
  }
  const choice = envelope.choices?.[0];
  if (!choice) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Provider envelope missing choices');
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    throw new ProviderError(
      'AI_INVALID_OUTPUT',
      choice.finish_reason === 'length'
        ? 'Provider output was truncated'
        : `Provider completion was ${choice.finish_reason}`,
    );
  }
  const content = choice.message?.content;
  if (!content || content.trim() === '') {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Provider returned empty content');
  }
  try {
    return parse(content);
  } catch (error) {
    throw new ProviderError(
      'AI_INVALID_OUTPUT',
      error instanceof Error ? error.message : 'Provider JSON failed schema validation',
    );
  }
}

export function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Fenced output is not a JSON object');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Message content was not JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Message content was not a JSON object');
  }
  return parsed;
}

function isTimeout(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'TimeoutError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof ProviderError)) {
    return true;
  }
  if (error.message.includes('authentication failed')) {
    return false;
  }
  return error.code !== 'AI_UNAVAILABLE' || error.message.includes('HTTP 5') || error.message.includes('rate limited') || error.message.includes('network');
}

function retryAfterMs(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterMs' in error) {
    const value = (error as { retryAfterMs?: number }).retryAfterMs;
    return typeof value === 'number' ? value : 0;
  }
  return 0;
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  return 0;
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (isTimeout(error)) {
    return new ProviderError('AI_TIMEOUT', 'Provider request timed out');
  }
  return new ProviderError('AI_INVALID_OUTPUT', 'Provider request failed');
}
