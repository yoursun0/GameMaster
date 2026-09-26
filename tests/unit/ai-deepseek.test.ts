import { describe, expect, test } from 'vitest';
import { chatCompletionsUrl, createDeepSeekMaster } from '@/server/ai/deepseek';
import { ProviderError, type InterpretContext } from '@/server/ai/types';
import { PROMPT_VERSION } from '@/server/ai/prompts';

const context: InterpretContext = {
  locale: 'en',
  actorId: 'player-0',
  text: 'I study the seal',
  useAbility: false,
  availableApproachIds: ['s0-insight'],
};

const validInterpret = {
  kind: 'check',
  approachId: 's0-insight',
  intentSummary: 'Study the seal',
};

function completion(content: string, finish: string = 'stop') {
  return {
    choices: [{ message: { content }, finish_reason: finish }],
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function master(fetchImpl: typeof fetch, sleep = async () => undefined) {
  return createDeepSeekMaster({
    apiKey: 'sk-test-key',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    fetch: fetchImpl,
    timeoutMs: 50,
    sleep,
  });
}

describe('DeepSeek URL', () => {
  test('posts to /chat/completions without duplicating /v1', () => {
    expect(chatCompletionsUrl('https://api.deepseek.com')).toBe(
      'https://api.deepseek.com/chat/completions',
    );
    expect(chatCompletionsUrl('https://api.deepseek.com/')).toBe(
      'https://api.deepseek.com/chat/completions',
    );
    expect(chatCompletionsUrl('https://api.deepseek.com/chat/completions')).toBe(
      'https://api.deepseek.com/chat/completions',
    );
  });
});

describe('DeepSeek adapter', () => {
  test('parses a valid interpretation and includes prompt version', async () => {
    let captured: ChatRequestLike | undefined;
    const gm = master(async (url, init) => {
      expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
      captured = JSON.parse(String(init?.body)) as ChatRequestLike;
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk-test-key',
      });
      return jsonResponse(200, completion(JSON.stringify(validInterpret)));
    });
    await expect(gm.interpret(context)).resolves.toEqual(validInterpret);
    expect(captured?.thinking).toEqual({ type: 'disabled' });
    expect(captured?.response_format).toEqual({ type: 'json_object' });
    expect(captured?.messages[0]?.content).toContain(PROMPT_VERSION);
    expect(JSON.stringify(captured?.messages)).toContain('untrustedPlayerText');
    expect(JSON.stringify(captured)).not.toContain('sk-test-key');
  });

  test('rejects fenced JSON after a single repair attempt', async () => {
    let calls = 0;
    const fenced = '```json\n' + JSON.stringify(validInterpret) + '\n```';
    const gm = master(async () => {
      calls += 1;
      return jsonResponse(200, completion(fenced));
    });
    await expect(gm.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
    expect(calls).toBe(2);
  });

  test('rejects extra keys and unknown approach IDs', async () => {
    const gm = master(async () =>
      jsonResponse(
        200,
        completion(
          JSON.stringify({ ...validInterpret, secret: 'nope' }),
        ),
      ),
    );
    await expect(gm.interpret(context)).rejects.toBeInstanceOf(ProviderError);

    const unknown = master(async () =>
      jsonResponse(
        200,
        completion(
          JSON.stringify({
            kind: 'check',
            approachId: 'invented',
            intentSummary: 'hack',
          }),
        ),
      ),
    );
    await expect(unknown.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  test('rejects empty content and truncated completions', async () => {
    const empty = master(async () => jsonResponse(200, completion('')));
    await expect(empty.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
    const truncated = master(async () =>
      jsonResponse(200, completion(JSON.stringify(validInterpret), 'length')),
    );
    await expect(truncated.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  test('rejects plain non-JSON and malformed field types', async () => {
    const plain = master(async () => jsonResponse(200, completion('not json at all')));
    await expect(plain.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
    const malformed = master(async () =>
      jsonResponse(
        200,
        completion(
          JSON.stringify({
            kind: 'check',
            approachId: 12,
            intentSummary: 'look',
          }),
        ),
      ),
    );
    await expect(malformed.interpret(context)).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  test('parses a valid narration', async () => {
    const narration = {
      paragraphs: ['The seal catches the lamplight.'],
      quote: null,
      prompt: 'What do you do next?',
      suggestions: [
        { text: 'Ask who waits nearby', approachId: 's0-presence' },
        { text: 'Watch the guards', approachId: 's0-insight' },
      ],
      journalFact: null,
      ending: null,
    };
    const gm = master(async () => jsonResponse(200, completion(JSON.stringify(narration))));
    await expect(
      gm.narrate({
        locale: 'en',
        actorId: 'player-0',
        outcome: 'success',
        availableApproachIds: ['s0-insight', 's0-presence'],
      }),
    ).resolves.toEqual(narration);
  });

  test('times out without leaking the API key', async () => {
    const gm = master(async () => {
      const error = new Error('aborted');
      error.name = 'TimeoutError';
      throw error;
    });
    await gm.interpret(context).then(
      () => {
        throw new Error('expected timeout');
      },
      (error: unknown) => {
        expect(error).toMatchObject({ code: 'AI_TIMEOUT' });
        expect(String(error)).not.toContain('sk-test-key');
      },
    );
  });

  test('does not retry 401 and retries 5xx once', async () => {
    let unauthorizedCalls = 0;
    const unauthorized = master(async () => {
      unauthorizedCalls += 1;
      return jsonResponse(401, { error: 'nope' });
    });
    await expect(unauthorized.interpret(context)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(unauthorizedCalls).toBe(1);

    let serverCalls = 0;
    const flaky = master(async () => {
      serverCalls += 1;
      if (serverCalls === 1) {
        return jsonResponse(503, { error: 'busy' });
      }
      return jsonResponse(200, completion(JSON.stringify(validInterpret)));
    });
    await expect(flaky.interpret(context)).resolves.toEqual(validInterpret);
    expect(serverCalls).toBe(2);
  });

  test('retries 429 when Retry-After is short', async () => {
    let calls = 0;
    const gm = master(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(429, { error: 'slow' }, { 'retry-after': '0' });
      }
      return jsonResponse(200, completion(JSON.stringify(validInterpret)));
    });
    await expect(gm.interpret(context)).resolves.toEqual(validInterpret);
    expect(calls).toBe(2);
  });
});

type ChatRequestLike = {
  thinking: unknown;
  response_format: unknown;
  messages: Array<{ content: string }>;
};
