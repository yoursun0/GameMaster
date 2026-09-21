import 'server-only';

import { randomUUID } from 'node:crypto';
import type { GameMaster, Interpretation, Narration } from '@/server/ai/types';
import { ProviderError, interpretationSchema, narrationSchema } from '@/server/ai/types';
import type { WorldPack } from '@/server/content/types';
import type { SqliteDatabase } from '@/server/db/connection';
import {
  GameRepository,
  type OperationRow,
  type SessionRow,
} from '@/server/db/repository';
import { GameServiceError, type ErrorCode } from '@/server/game/errors';
import { requestHash } from '@/server/game/hash';
import {
  type ActionPreviewDTO,
  type PendingOperationDTO,
  type SessionDTO,
  projectSession,
} from '@/server/game/projection';
import {
  ABILITY_COST,
  ABILITY_MODIFIER,
  conditionModifierFor,
  createInitialState,
  isApproachAvailable,
  resolveAction,
  rollD20,
  stakesFor,
} from '@/server/game/rules';
import { currentScene } from '@/server/game/scenes';
import type { EngineAction, SessionState } from '@/server/game/schemas';
import { PROFILE_STATS, attributeValue, profileOf } from '@/server/game/profiles';
import { hashBrowserCredential, issueBrowserCredential } from '@/server/security/browser';
import { TokenBucketLimiter } from '@/server/security/limits';
import { uiString } from '@/shared/i18n';
import type {
  CreateSessionRequest,
  Locale,
  SubmitAction,
} from '@/shared/schemas';

const LEASE_MS = 120_000;

type Proposal = {
  approachId: string;
  interpretation: Interpretation;
  useAbility: boolean;
  preview: ActionPreviewDTO;
};

type ResolvedPlan = {
  actorId: string;
  playerText: string | null;
  engineCheck: Extract<
    ReturnType<typeof resolveAction>,
    { ok: true }
  >['check'];
  nextState: SessionState;
  consumedTurn: boolean;
  sceneResult: 'cleared' | 'setback' | null;
  needsNarrator: boolean;
  localParagraphs: string[];
  messageIds: { player?: string; check?: string; gm: string; ending?: string };
};

export type GameServiceDeps = {
  db: SqliteDatabase;
  packs: WorldPack[];
  provider: GameMaster | null;
  now?: () => Date;
  rollD20?: () => number;
  leaseMs?: number;
};

export type OwnerContext = {
  ownerId: string;
  credential: string;
  issued: boolean;
};

export type ActionResponse = {
  status: 200 | 202;
  session: SessionDTO;
  operation: PendingOperationDTO;
  committedRevision?: number;
};

export class GameService {
  private readonly repo: GameRepository;
  private readonly packs: WorldPack[];
  private readonly provider: GameMaster | null;
  private readonly now: () => Date;
  private readonly roll: () => number;
  private readonly leaseMs: number;
  private readonly actionLimiter: TokenBucketLimiter;

  constructor(deps: GameServiceDeps) {
    this.repo = new GameRepository(deps.db);
    this.packs = deps.packs;
    this.provider = deps.provider;
    this.now = deps.now ?? (() => new Date());
    this.roll = deps.rollD20 ?? rollD20;
    this.leaseMs = deps.leaseMs ?? LEASE_MS;
    this.actionLimiter = new TokenBucketLimiter(
      () => this.now().getTime(),
      12,
    );
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  identify(credential: string | undefined): OwnerContext | null {
    if (!credential) {
      return null;
    }
    const owner = this.repo.getOwnerByHash(hashBrowserCredential(credential));
    if (!owner) {
      return null;
    }
    return { ownerId: owner.id, credential, issued: false };
  }

  issueOwner(): OwnerContext {
    const credential = issueBrowserCredential();
    const ownerId = randomUUID();
    this.repo.insertOwner({
      id: ownerId,
      credential_hash: hashBrowserCredential(credential),
      active_session_id: null,
      created_at: this.nowIso(),
    });
    return { ownerId, credential, issued: true };
  }

  getSession(owner: OwnerContext | null): { session: SessionDTO | null } {
    if (!owner) {
      return { session: null };
    }
    const record = this.repo.getOwnerById(owner.ownerId);
    if (!record?.active_session_id) {
      return { session: null };
    }
    const row = this.repo.getSessionById(record.active_session_id);
    if (!row) {
      return { session: null };
    }
    return { session: this.project(row) };
  }

  createSession(
    owner: OwnerContext,
    body: CreateSessionRequest,
  ): { status: 200 | 201; session: SessionDTO; credential?: string } {
    if (!this.provider) {
      throw new GameServiceError('AI_NOT_CONFIGURED');
    }
    const pack = this.requirePack(body.worldId);
    const characterIds = body.players.map((player) => player.characterId);
    if (new Set(characterIds).size !== characterIds.length) {
      throw new GameServiceError('INVALID_INPUT', body.locale);
    }
    for (const player of body.players) {
      if (!pack.characters.some((character) => character.id === player.characterId)) {
        throw new GameServiceError('INVALID_INPUT', body.locale);
      }
    }
    const hash = requestHash(body);
    const existing = this.repo.getSessionByCreateRequest(owner.ownerId, body.createRequestId);
    if (existing) {
      if (existing.create_request_hash !== hash) {
        throw new GameServiceError('IDEMPOTENCY_CONFLICT', body.locale);
      }
      return { status: 200, session: this.project(existing) };
    }

    const created = this.repo.transaction(() => {
      const active = this.repo.getActiveSessionForOwner(owner.ownerId);
      if (active) {
        if (body.replaceSessionId !== active.id) {
          throw new GameServiceError('REPLACEMENT_REQUIRED', body.locale, {
            currentRevision: active.revision,
          });
        }
        this.abandonRow(active);
      }
      const sessionId = randomUUID();
      const players = body.players.map((player) => ({
        playerId: randomUUID(),
        displayName: player.displayName,
        characterId: player.characterId,
      }));
      const state = createInitialState(
        { worldId: pack.id, locale: body.locale, players },
        pack,
      );
      const timestamp = this.nowIso();
      const row: SessionRow = {
        id: sessionId,
        owner_id: owner.ownerId,
        create_request_id: body.createRequestId,
        create_request_hash: hash,
        revision: 0,
        status: 'active',
        state_json: JSON.stringify(state),
        pending_operation_id: null,
        created_at: timestamp,
        updated_at: timestamp,
      };
      this.repo.insertSession(row);
      this.repo.setActiveSession(owner.ownerId, sessionId);
      const scene = currentScene(pack, state);
      this.repo.insertMessage({
        id: randomUUID(),
        session_id: sessionId,
        operation_id: null,
        scene_id: scene.id,
        kind: 'gm',
        payload_json: JSON.stringify({
          paragraphs: [scene.opening[body.locale]],
          quote: null,
        }),
        created_at: timestamp,
      });
      return this.repo.getSessionById(sessionId)!;
    });
    return {
      status: 201,
      session: this.project(created),
      credential: owner.issued ? owner.credential : undefined,
    };
  }

  endSession(
    owner: OwnerContext,
    body: { expectedRevision: number; confirm: true },
  ): { session: SessionDTO } {
    const row = this.requireOwnedSession(owner);
    if (row.revision !== body.expectedRevision) {
      throw new GameServiceError('STALE_REVISION', this.localeOf(row), {
        currentRevision: row.revision,
      });
    }
    const abandoned = this.repo.transaction(() => {
      this.abandonRow(row);
      return this.repo.getSessionById(row.id)!;
    });
    return { session: this.project(abandoned) };
  }

  async submitAction(owner: OwnerContext, command: SubmitAction): Promise<ActionResponse> {
    const row = this.requireOwnedSession(owner);
    const locale = this.localeOf(row);
    const existing = this.repo.getOperationById(command.operationId);
    if (existing) {
      return this.replayOperation(owner, existing, command);
    }
    if (row.status !== 'active') {
      throw new GameServiceError('SESSION_ENDED', locale, { currentRevision: row.revision });
    }
    const state = this.repo.parseState(row);
    if (command.expectedRevision !== row.revision) {
      throw new GameServiceError('STALE_REVISION', locale, { currentRevision: row.revision });
    }
    const actor = state.party.find((member) => member.playerId === command.actorId);
    if (!actor || actor.seat !== state.turn.activeSeat) {
      throw new GameServiceError('INVALID_TARGET', locale, { currentRevision: row.revision });
    }
    const unfinished = this.repo.getUnfinishedOperation(row.id);
    if (unfinished) {
      throw new GameServiceError('SESSION_BUSY', locale, {
        operationId: unfinished.id,
        currentRevision: row.revision,
      });
    }
    const limit = this.actionLimiter.take(owner.ownerId);
    if (!limit.ok) {
      throw new GameServiceError('RATE_LIMITED', locale, {
        currentRevision: row.revision,
      });
    }

    const timestamp = this.nowIso();
    const hash = requestHash(command);
    const initialPhase =
      command.kind === 'act'
        ? 'interpreting'
        : command.kind === 'ask'
          ? 'narrating'
          : 'resolving';
    const resumeStage =
      command.kind === 'act' ? 'interpret' : command.kind === 'ask' ? 'narrate' : 'resolve';
    try {
      this.repo.transaction(() => {
        this.repo.insertOperation({
          id: command.operationId,
          session_id: row.id,
          request_hash: hash,
          command_json: JSON.stringify(command),
          base_revision: row.revision,
          phase: initialPhase,
          resume_stage: resumeStage,
          proposal_json: null,
          resolution_json: null,
          result_json: null,
          error_code: null,
          lease_token: 1,
          lease_until: new Date(this.now().getTime() + this.leaseMs).toISOString(),
          provider_attempts: 0,
          created_at: timestamp,
          updated_at: timestamp,
        });
        this.repo.setPendingOperation(row.id, command.operationId, timestamp);
      });
    } catch (error) {
      const conflict = this.repo.getOperationById(command.operationId);
      if (conflict) {
        return this.replayOperation(owner, conflict, command);
      }
      const busy = this.repo.getUnfinishedOperation(row.id);
      if (busy) {
        throw new GameServiceError('SESSION_BUSY', locale, {
          operationId: busy.id,
          currentRevision: row.revision,
        });
      }
      throw error;
    }

    if (command.kind === 'act') {
      return this.runAct(owner, command.operationId);
    }
    if (command.kind === 'ask') {
      return this.runAsk(owner, command.operationId);
    }
    return this.runLocal(owner, command.operationId);
  }

  async confirmAction(
    owner: OwnerContext,
    operationId: string,
    expectedRevision: number,
  ): Promise<ActionResponse> {
    const op = this.requireOwnedOperation(owner, operationId);
    if (op.phase === 'committed') {
      return this.replayOperation(owner, op);
    }
    if (op.phase !== 'awaiting_confirmation') {
      if (this.inFlight(op)) {
        return this.accepted(owner, op);
      }
      if (op.resolution_json) {
        return this.finishFromResolution(owner, op.id);
      }
      throw new GameServiceError('INVALID_INPUT', this.localeOfOp(op));
    }
    const row = this.repo.getSessionById(op.session_id)!;
    if (expectedRevision !== op.base_revision) {
      throw new GameServiceError('STALE_REVISION', this.localeOf(row), {
        currentRevision: row.revision,
        operationId,
      });
    }
    this.repo.claimLease({
      id: op.id,
      phase: 'resolving',
      resume_stage: 'resolve',
      lease_until: new Date(this.now().getTime() + this.leaseMs).toISOString(),
      updated_at: this.nowIso(),
    });
    return this.finishFromResolution(owner, op.id);
  }

  async retryAction(
    owner: OwnerContext,
    operationId: string,
    expectedRevision: number,
  ): Promise<ActionResponse> {
    const op = this.requireOwnedOperation(owner, operationId);
    if (op.phase === 'committed') {
      return this.replayOperation(owner, op);
    }
    if (op.phase === 'awaiting_confirmation') {
      throw new GameServiceError('INVALID_INPUT', this.localeOfOp(op), {
        operationId,
      });
    }
    const row = this.repo.getSessionById(op.session_id)!;
    if (expectedRevision !== row.revision && expectedRevision !== op.base_revision) {
      throw new GameServiceError('STALE_REVISION', this.localeOf(row), {
        currentRevision: row.revision,
        operationId,
      });
    }
    if (this.inFlight(op)) {
      return this.accepted(owner, op);
    }
    this.repo.claimLease({
      id: op.id,
      phase: op.resolution_json
        ? 'narrating'
        : op.proposal_json
          ? 'resolving'
          : 'interpreting',
      resume_stage: op.resolution_json
        ? 'narrate'
        : op.proposal_json
          ? 'resolve'
          : 'interpret',
      lease_until: new Date(this.now().getTime() + this.leaseMs).toISOString(),
      updated_at: this.nowIso(),
    });
    if (op.resolution_json) {
      return this.finishFromResolution(owner, op.id);
    }
    if (op.proposal_json) {
      return this.finishFromResolution(owner, op.id);
    }
    const command = JSON.parse(op.command_json) as SubmitAction;
    if (command.kind === 'act') {
      return this.runAct(owner, op.id);
    }
    if (command.kind === 'ask') {
      return this.runAsk(owner, op.id);
    }
    return this.runLocal(owner, op.id);
  }

  cancelAction(
    owner: OwnerContext,
    operationId: string,
    expectedRevision: number,
  ): ActionResponse {
    const op = this.requireOwnedOperation(owner, operationId);
    const locale = this.localeOfOp(op);
    if (op.phase === 'committed' || op.phase === 'cancelled') {
      return this.replayOperation(owner, op);
    }
    if (op.resolution_json) {
      throw new GameServiceError('CANNOT_CANCEL_RESOLVED', locale, { operationId });
    }
    const row = this.repo.getSessionById(op.session_id)!;
    if (expectedRevision !== row.revision && expectedRevision !== op.base_revision) {
      throw new GameServiceError('STALE_REVISION', locale, {
        currentRevision: row.revision,
        operationId,
      });
    }
    this.repo.transaction(() => {
      this.repo.updateOperation({
        id: op.id,
        phase: 'cancelled',
        result_json: JSON.stringify({ cancelled: true }),
        lease_until: null,
        updated_at: this.nowIso(),
      });
      this.repo.setPendingOperation(op.session_id, null, this.nowIso());
    });
    const latest = this.repo.getSessionById(op.session_id)!;
    const cancelled = this.repo.getOperationById(op.id)!;
    return {
      status: 200,
      session: this.project(latest),
      operation: this.pendingDto(cancelled),
    };
  }

  getOperation(owner: OwnerContext, operationId: string): ActionResponse {
    const op = this.requireOwnedOperation(owner, operationId);
    const row = this.repo.getSessionById(op.session_id)!;
    return {
      status: this.inFlight(op) ? 202 : 200,
      session: this.project(row),
      operation: this.pendingDto(op),
      committedRevision:
        op.phase === 'committed'
          ? (JSON.parse(op.result_json ?? '{}') as { committedRevision?: number })
              .committedRevision
          : undefined,
    };
  }

  getTranscript(
    owner: OwnerContext,
    query: { before?: number; limit?: number },
  ): { messages: ReturnType<typeof projectSession>['recentMessages']; nextOlderCursor: number | null } {
    const row = this.requireOwnedSession(owner);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const messages = this.repo.listMessages(row.id, query.before ?? null, limit);
    const oldest = messages[0]?.seq ?? null;
    const older = oldest
      ? this.repo.listMessages(row.id, oldest, 1)
      : [];
    return {
      messages: projectSession({
        row,
        pack: this.requirePack(this.repo.parseState(row).worldId),
        messages,
        pending: null,
      }).recentMessages,
      nextOlderCursor: older.length > 0 ? oldest : null,
    };
  }

  private async runAct(owner: OwnerContext, operationId: string): Promise<ActionResponse> {
    const op = this.repo.getOperationById(operationId)!;
    const row = this.repo.getSessionById(op.session_id)!;
    const state = this.repo.parseState(row);
    const pack = this.requirePack(state.worldId);
    const command = JSON.parse(op.command_json) as Extract<SubmitAction, { kind: 'act' }>;
    const locale = state.locale;
    if (!this.provider) {
      throw new GameServiceError('AI_NOT_CONFIGURED', locale, { operationId });
    }
    const scene = currentScene(pack, state);
    const available = scene.approaches
      .filter((approach) => !state.scene.closingReason && isApproachAvailable(state, approach))
      .map((approach) => approach.id);
    let interpretation: Interpretation;
    try {
      this.bumpAttempts(op.id);
      interpretation = interpretationSchema.parse(
        await this.provider.interpret({
          locale,
          actorId: command.actorId,
          text: command.text,
          useAbility: Boolean(command.useAbility),
          availableApproachIds: available,
        }),
      );
    } catch (error) {
      return this.providerFailure(owner, op.id, error);
    }
    if (interpretation.kind === 'check') {
      try {
        const preview = this.buildPreview(state, pack, command, interpretation.approachId);
        const token = op.lease_token;
        const saved = this.repo.casUpdateOperation({
          id: op.id,
          expectedToken: token,
          nowIso: this.nowIso(),
          updated_at: this.nowIso(),
          fields: {
            phase: 'awaiting_confirmation',
            resume_stage: null,
            proposal_json: JSON.stringify({
              approachId: interpretation.approachId,
              interpretation,
              useAbility: Boolean(command.useAbility),
              preview,
            } satisfies Proposal),
            lease_until: null,
          },
        });
        if (!saved) {
          return this.accepted(owner, this.repo.getOperationById(op.id)!);
        }
        const latest = this.repo.getSessionById(row.id)!;
        return {
          status: 200,
          session: this.project(latest),
          operation: this.pendingDto(this.repo.getOperationById(op.id)!),
        };
      } catch (error) {
        if (error instanceof GameServiceError) {
          this.terminalCancel(op.id, row.id, error.code);
          throw error;
        }
        throw error;
      }
    }
    return this.resolveInterpreted(owner, op.id, interpretation);
  }

  private async runAsk(owner: OwnerContext, operationId: string): Promise<ActionResponse> {
    return this.resolveInterpreted(owner, operationId, {
      kind: 'question',
      question: 'question',
    });
  }

  private async runLocal(owner: OwnerContext, operationId: string): Promise<ActionResponse> {
    return this.finishFromResolution(owner, operationId);
  }

  private async resolveInterpreted(
    owner: OwnerContext,
    operationId: string,
    interpretation: Interpretation,
  ): Promise<ActionResponse> {
    const op = this.repo.getOperationById(operationId)!;
    const command = JSON.parse(op.command_json) as SubmitAction;
    const row = this.repo.getSessionById(op.session_id)!;
    const state = this.repo.parseState(row);
    const pack = this.requirePack(state.worldId);
    const engineAction = this.toEngineAction(command, interpretation);
    const result = resolveAction(state, pack, engineAction, this.roll);
    if (!result.ok) {
      this.terminalCancel(op.id, row.id, result.code);
      throw new GameServiceError(result.code, state.locale, {
        operationId,
        currentRevision: row.revision,
      });
    }
    const plan = this.makePlan(command, result, false);
    this.savePlan(op, plan, 'narrating');
    return this.finishFromResolution(owner, operationId);
  }

  private async finishFromResolution(
    owner: OwnerContext,
    operationId: string,
  ): Promise<ActionResponse> {
    const op = this.repo.getOperationById(operationId)!;
    const row = this.repo.getSessionById(op.session_id)!;
    const state = this.repo.parseState(row);
    const pack = this.requirePack(state.worldId);
    const command = JSON.parse(op.command_json) as SubmitAction;
    const locale = state.locale;
    let plan: ResolvedPlan;
    if (op.resolution_json) {
      plan = JSON.parse(op.resolution_json) as ResolvedPlan;
    } else {
      const proposal = op.proposal_json
        ? (JSON.parse(op.proposal_json) as Proposal)
        : null;
      const engineAction: EngineAction = proposal
        ? {
            kind: 'check',
            actorId: command.actorId,
            approachId: proposal.approachId,
            useAbility: proposal.useAbility,
          }
        : this.toEngineAction(command);
      const result = this.repo.transaction(() => {
        const fresh = this.repo.getOperationById(op.id)!;
        if (fresh.resolution_json) {
          return JSON.parse(fresh.resolution_json) as ResolvedPlan;
        }
        const resolved = resolveAction(state, pack, engineAction, this.roll);
        if (!resolved.ok) {
          throw new GameServiceError(resolved.code, locale, {
            operationId,
            currentRevision: row.revision,
          });
        }
        const created = this.makePlan(
          command,
          resolved,
          Boolean(proposal) || command.kind === 'act',
        );
        this.savePlan(fresh, created, 'narrating');
        return created;
      });
      plan = result;
    }

    let narration: Narration | null = null;
    if (plan.needsNarrator) {
      if (!this.provider) {
        return this.markRetryable(owner, op.id, 'AI_NOT_CONFIGURED');
      }
      try {
        this.bumpAttempts(op.id);
        narration = narrationSchema.parse(
          await this.provider.narrate({
            locale,
            actorId: plan.actorId,
            text: plan.playerText ?? undefined,
            outcome: plan.engineCheck?.outcome ?? plan.sceneResult ?? command.kind,
          }),
        );
      } catch (error) {
        return this.providerFailure(owner, op.id, error);
      }
    }

    const committed = this.commitPlan(op.id, plan, narration);
    if (!committed) {
      const latestOp = this.repo.getOperationById(op.id)!;
      if (latestOp.phase === 'committed') {
        return this.replayOperation(owner, latestOp);
      }
      return this.accepted(owner, latestOp);
    }
    return committed;
  }

  private commitPlan(
    operationId: string,
    plan: ResolvedPlan,
    narration: Narration | null,
  ): ActionResponse | null {
    const op = this.repo.getOperationById(operationId)!;
    const row = this.repo.getSessionById(op.session_id)!;
    const pack = this.requirePack(this.repo.parseState(row).worldId);
    const locale = this.localeOf(row);
    const timestamp = this.nowIso();
    return this.repo.transaction(() => {
      const current = this.repo.getOperationById(operationId)!;
      if (current.phase === 'committed') {
        return null;
      }
      if (current.lease_token !== op.lease_token) {
        return null;
      }
      if (current.lease_until && current.lease_until < timestamp) {
        return null;
      }
      const nextState = structuredClone(plan.nextState);
      const paragraphs =
        narration?.paragraphs ?? plan.localParagraphs;
      if (narration) {
        if (narration.prompt) {
          nextState.currentPrompt = narration.prompt;
        }
        if (narration.suggestions.length > 0 && nextState.status === 'active') {
          nextState.suggestions = narration.suggestions;
        }
        if (narration.journalFact) {
          const allowed = new Set(nextState.revealedFactIds);
          if (
            narration.journalFact.evidenceIds.every((id) => allowed.has(id))
          ) {
            nextState.publicJournal = [
              ...nextState.publicJournal,
              {
                messageId: plan.messageIds.gm,
                sceneId: currentScene(pack, nextState).id,
                text: narration.journalFact.text,
              },
            ].slice(-24);
          } else {
            throw new GameServiceError('AI_INVALID_OUTPUT', locale, {
              operationId,
            });
          }
        }
        if (nextState.ending && narration.ending) {
          const playerIds = new Set(nextState.party.map((member) => member.playerId));
          if (
            narration.ending.epilogues.length !== nextState.party.length ||
            narration.ending.epilogues.some((entry) => !playerIds.has(entry.playerId))
          ) {
            throw new GameServiceError('AI_INVALID_OUTPUT', locale, {
              operationId,
            });
          }
          nextState.ending = {
            kind: nextState.ending.kind,
            summary: narration.ending.summary,
            epilogues: narration.ending.epilogues,
          };
        }
      }
      const sceneId = currentScene(pack, this.repo.parseState(row)).id;
      if (plan.playerText && plan.messageIds.player) {
        this.repo.insertMessage({
          id: plan.messageIds.player,
          session_id: row.id,
          operation_id: operationId,
          scene_id: sceneId,
          kind: 'player',
          payload_json: JSON.stringify({
            actorId: plan.actorId,
            text: plan.playerText,
          }),
          created_at: timestamp,
        });
      }
      if (plan.engineCheck && plan.messageIds.check) {
        this.repo.insertMessage({
          id: plan.messageIds.check,
          session_id: row.id,
          operation_id: operationId,
          scene_id: sceneId,
          kind: 'check',
          payload_json: JSON.stringify(plan.engineCheck),
          created_at: timestamp,
        });
      }
      this.repo.insertMessage({
        id: plan.messageIds.gm,
        session_id: row.id,
        operation_id: operationId,
        scene_id: sceneId,
        kind: narration?.ending ? 'ending' : 'gm',
        payload_json: JSON.stringify({
          paragraphs,
          quote: narration?.quote ?? null,
        }),
        created_at: timestamp,
      });
      const nextRevision = row.revision + 1;
      const written = this.repo.casUpdateSession({
        id: row.id,
        expectedRevision: row.revision,
        expectedPending: operationId,
        revision: nextRevision,
        status: nextState.status,
        state_json: JSON.stringify(nextState),
        pending_operation_id: null,
        updated_at: timestamp,
      });
      if (!written) {
        return null;
      }
      const savedOp = this.repo.casUpdateOperation({
        id: operationId,
        expectedToken: current.lease_token,
        nowIso: timestamp,
        updated_at: timestamp,
        fields: {
          phase: 'committed',
          result_json: JSON.stringify({
            committedRevision: nextRevision,
            messageIds: plan.messageIds,
          }),
          error_code: null,
          lease_until: null,
        },
      });
      if (!savedOp) {
        throw new GameServiceError('SAVE_UNAVAILABLE', locale, { operationId });
      }
      const latest = this.repo.getSessionById(row.id)!;
      return {
        status: 200 as const,
        session: this.project(latest),
        operation: this.pendingDto(this.repo.getOperationById(operationId)!),
        committedRevision: nextRevision,
      };
    });
  }

  private makePlan(
    command: SubmitAction,
    result: Extract<ReturnType<typeof resolveAction>, { ok: true }>,
    fromCheck: boolean,
  ): ResolvedPlan {
    const locale = result.state.locale;
    const actor = result.state.party.find((member) => member.playerId === command.actorId);
    const name = actor?.displayName ?? 'Someone';
    const text = 'text' in command ? command.text : null;
    const localKey =
      command.kind === 'pass'
        ? 'narrate.pass'
        : command.kind === 'help'
          ? 'narrate.help'
          : command.kind === 'use_item'
            ? 'narrate.item'
            : command.kind === 'rest'
              ? 'narrate.rest'
              : 'narrate.automatic';
    const needsNarrator = Boolean(result.sceneResult) || command.kind === 'ask' || fromCheck;
    return {
      actorId: command.actorId,
      playerText: text ?? (command.kind === 'pass' ? 'pass' : null),
      engineCheck: result.check,
      nextState: result.state,
      consumedTurn: result.consumedTurn,
      sceneResult: result.sceneResult,
      needsNarrator,
      localParagraphs: [
        uiString(locale, localKey, {
          name,
          target: 'targetPlayerId' in command ? command.targetPlayerId : '',
        }),
      ],
      messageIds: {
        player: text || command.kind === 'pass' ? randomUUID() : undefined,
        check: result.check ? randomUUID() : undefined,
        gm: randomUUID(),
      },
    };
  }

  private savePlan(op: OperationRow, plan: ResolvedPlan, phase: OperationRow['phase']): void {
    const saved = this.repo.casUpdateOperation({
      id: op.id,
      expectedToken: op.lease_token,
      nowIso: this.nowIso(),
      updated_at: this.nowIso(),
      fields: {
        phase,
        resume_stage: 'narrate',
        resolution_json: JSON.stringify(plan),
      },
    });
    if (!saved) {
      throw new GameServiceError('SAVE_UNAVAILABLE', 'en', { operationId: op.id });
    }
  }

  private buildPreview(
    state: SessionState,
    pack: WorldPack,
    command: Extract<SubmitAction, { kind: 'act' }>,
    approachId: string,
  ): ActionPreviewDTO {
    const scene = currentScene(pack, state);
    const approach = scene.approaches.find((entry) => entry.id === approachId);
    if (!approach) {
      throw new GameServiceError('INVALID_INPUT', state.locale);
    }
    if (state.scene.closingReason || !isApproachAvailable(state, approach)) {
      throw new GameServiceError(
        state.scene.closingReason ? 'INVALID_INPUT' : 'REPEAT_APPROACH',
        state.locale,
      );
    }
    const actor = state.party.find((member) => member.playerId === command.actorId)!;
    const profile = profileOf(pack, actor.characterId);
    const stats = attributeValue(profile, approach.attribute);
    const useAbility = Boolean(command.useAbility);
    if (useAbility) {
      if (PROFILE_STATS[profile].abilityAttribute !== approach.attribute) {
        throw new GameServiceError('ABILITY_NOT_APPLICABLE', state.locale);
      }
      if (actor.mp < ABILITY_COST) {
        throw new GameServiceError('INSUFFICIENT_MP', state.locale);
      }
    }
    return {
      actorId: actor.playerId,
      actionText: command.text,
      attribute: approach.attribute,
      target: approach.target,
      attributeValue: stats,
      conditionModifier: conditionModifierFor(actor, approach.attribute),
      abilityModifier: useAbility ? ABILITY_MODIFIER : 0,
      mpCost: useAbility ? ABILITY_COST : 0,
      stakes: stakesFor(approach.risk, state.locale),
    };
  }

  private toEngineAction(
    command: SubmitAction,
    interpretation?: Interpretation,
  ): EngineAction {
    if (interpretation?.kind === 'check' && command.kind === 'act') {
      return {
        kind: 'check',
        actorId: command.actorId,
        approachId: interpretation.approachId,
        useAbility: Boolean(command.useAbility),
      };
    }
    if (interpretation?.kind === 'automatic') {
      return { kind: 'automatic', actorId: command.actorId };
    }
    if (interpretation?.kind === 'question' || command.kind === 'ask') {
      return { kind: 'question', actorId: command.actorId };
    }
    if (interpretation?.kind === 'clarify') {
      return { kind: 'clarify', actorId: command.actorId };
    }
    if (interpretation?.kind === 'impossible') {
      return { kind: 'impossible', actorId: command.actorId };
    }
    if (command.kind === 'pass') {
      return { kind: 'pass', actorId: command.actorId };
    }
    if (command.kind === 'help') {
      return {
        kind: 'help',
        actorId: command.actorId,
        targetPlayerId: command.targetPlayerId,
      };
    }
    if (command.kind === 'use_item') {
      return {
        kind: 'use_item',
        actorId: command.actorId,
        itemId: command.itemId,
        targetPlayerId: command.targetPlayerId,
      };
    }
    if (command.kind === 'rest') {
      return { kind: 'rest', actorId: command.actorId };
    }
    return { kind: 'automatic', actorId: command.actorId };
  }

  private project(row: SessionRow): SessionDTO {
    const state = this.repo.parseState(row);
    const pack = this.requirePack(state.worldId);
    const pendingRow = row.pending_operation_id
      ? this.repo.getOperationById(row.pending_operation_id)
      : undefined;
    const messages = this.repo.latestMessages(row.id, 30);
    return projectSession({
      row,
      pack,
      messages,
      pending: pendingRow ? this.pendingDto(pendingRow) : null,
    });
  }

  private pendingDto(op: OperationRow): PendingOperationDTO {
    const command = JSON.parse(op.command_json) as SubmitAction;
    const proposal = op.proposal_json
      ? (JSON.parse(op.proposal_json) as Proposal)
      : null;
    const expired = Boolean(op.lease_until && op.lease_until < this.nowIso());
    const inFlight = ['interpreting', 'resolving', 'narrating'].includes(op.phase);
    const interrupted = inFlight && expired;
    return {
      id: op.id,
      phase: interrupted ? 'interrupted' : op.phase,
      canRetry: op.phase === 'retryable_error' || interrupted,
      canCancel: !op.resolution_json && op.phase !== 'committed' && op.phase !== 'cancelled',
      submittedText: 'text' in command ? command.text : command.kind,
      actorId: command.actorId,
      errorCode: op.error_code,
      preview: proposal?.preview ?? null,
    };
  }

  private inFlight(op: OperationRow): boolean {
    return (
      ['interpreting', 'resolving', 'narrating'].includes(op.phase) &&
      Boolean(op.lease_until && op.lease_until >= this.nowIso())
    );
  }

  private replayOperation(
    owner: OwnerContext,
    op: OperationRow,
    command?: SubmitAction,
  ): ActionResponse {
    if (command && requestHash(command) !== op.request_hash) {
      throw new GameServiceError('IDEMPOTENCY_CONFLICT', this.localeOfOp(op), {
        operationId: op.id,
      });
    }
    const row = this.repo.getSessionById(op.session_id)!;
    if (row.owner_id !== owner.ownerId) {
      throw new GameServiceError('NOT_FOUND');
    }
    const resultJson = op.result_json
      ? (JSON.parse(op.result_json) as { committedRevision?: number })
      : {};
    return {
      status: this.inFlight(op) ? 202 : 200,
      session: this.project(row),
      operation: this.pendingDto(op),
      committedRevision: resultJson.committedRevision,
    };
  }

  private accepted(owner: OwnerContext, op: OperationRow): ActionResponse {
    const row = this.repo.getSessionById(op.session_id)!;
    return {
      status: 202,
      session: this.project(row),
      operation: this.pendingDto(op),
    };
  }

  private requirePack(id: string): WorldPack {
    const pack = this.packs.find((entry) => entry.id === id);
    if (!pack) {
      throw new GameServiceError('INVALID_INPUT');
    }
    return pack;
  }

  private requireOwnedSession(owner: OwnerContext): SessionRow {
    const record = this.repo.getOwnerById(owner.ownerId);
    if (!record?.active_session_id) {
      throw new GameServiceError('NOT_FOUND');
    }
    const row = this.repo.getSessionById(record.active_session_id);
    if (!row || row.owner_id !== owner.ownerId) {
      throw new GameServiceError('NOT_FOUND');
    }
    return row;
  }

  private requireOwnedOperation(owner: OwnerContext, operationId: string): OperationRow {
    const op = this.repo.getOperationById(operationId);
    if (!op) {
      throw new GameServiceError('NOT_FOUND');
    }
    const row = this.repo.getSessionById(op.session_id);
    if (!row || row.owner_id !== owner.ownerId) {
      throw new GameServiceError('NOT_FOUND');
    }
    return op;
  }

  private localeOf(row: SessionRow): Locale {
    return this.repo.parseState(row).locale;
  }

  private localeOfOp(op: OperationRow): Locale {
    const row = this.repo.getSessionById(op.session_id);
    return row ? this.localeOf(row) : 'en';
  }

  private abandonRow(row: SessionRow): void {
    const timestamp = this.nowIso();
    const pending = row.pending_operation_id
      ? this.repo.getOperationById(row.pending_operation_id)
      : undefined;
    if (pending && pending.phase !== 'committed' && pending.phase !== 'cancelled') {
      this.repo.invalidateLease(pending.id, timestamp);
      this.repo.updateOperation({
        id: pending.id,
        phase: 'cancelled',
        result_json: JSON.stringify({ cancelled: true, abandoned: true }),
        updated_at: timestamp,
      });
    }
    const state = this.repo.parseState(row);
    state.status = 'abandoned';
    this.repo.updateSession({
      id: row.id,
      revision: row.revision,
      status: 'abandoned',
      state_json: JSON.stringify(state),
      pending_operation_id: null,
      updated_at: timestamp,
    });
  }

  private terminalCancel(operationId: string, sessionId: string, code: string): void {
    const timestamp = this.nowIso();
    this.repo.transaction(() => {
      this.repo.updateOperation({
        id: operationId,
        phase: 'cancelled',
        error_code: code,
        result_json: JSON.stringify({ error: code }),
        lease_until: null,
        updated_at: timestamp,
      });
      this.repo.setPendingOperation(sessionId, null, timestamp);
    });
  }

  private bumpAttempts(operationId: string): void {
    const op = this.repo.getOperationById(operationId);
    if (!op) return;
    this.repo.updateOperation({
      id: operationId,
      provider_attempts: op.provider_attempts + 1,
      updated_at: this.nowIso(),
    });
  }

  private providerFailure(
    owner: OwnerContext,
    operationId: string,
    error: unknown,
  ): ActionResponse {
    const code: ErrorCode =
      error instanceof ProviderError
        ? error.code
        : error instanceof GameServiceError
          ? error.code
          : 'AI_INVALID_OUTPUT';
    return this.markRetryable(owner, operationId, code);
  }

  private markRetryable(
    owner: OwnerContext,
    operationId: string,
    code: ErrorCode,
  ): ActionResponse {
    const op = this.repo.getOperationById(operationId)!;
    this.repo.updateOperation({
      id: operationId,
      phase: 'retryable_error',
      error_code: code,
      lease_until: null,
      updated_at: this.nowIso(),
    });
    const latest = this.repo.getOperationById(operationId)!;
    const row = this.repo.getSessionById(op.session_id)!;
    return {
      status: 200,
      session: this.project(row),
      operation: this.pendingDto(latest),
    };
  }
}
