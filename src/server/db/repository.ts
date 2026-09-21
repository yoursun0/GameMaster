import 'server-only';

import type { SqliteDatabase } from './connection';
import type { SessionState } from '@/server/game/schemas';
import { sessionStateSchema } from '@/server/game/schemas';

export type OperationPhase =
  | 'interpreting'
  | 'awaiting_confirmation'
  | 'resolving'
  | 'narrating'
  | 'retryable_error'
  | 'committed'
  | 'cancelled';

export type ResumeStage = 'interpret' | 'resolve' | 'narrate';

export type OwnerRow = {
  id: string;
  credential_hash: string;
  active_session_id: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  owner_id: string;
  create_request_id: string;
  create_request_hash: string;
  revision: number;
  status: 'active' | 'completed' | 'abandoned';
  state_json: string;
  pending_operation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationRow = {
  id: string;
  session_id: string;
  request_hash: string;
  command_json: string;
  base_revision: number;
  phase: OperationPhase;
  resume_stage: ResumeStage | null;
  proposal_json: string | null;
  resolution_json: string | null;
  result_json: string | null;
  error_code: string | null;
  lease_token: number;
  lease_until: string | null;
  provider_attempts: number;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  seq: number;
  id: string;
  session_id: string;
  operation_id: string | null;
  scene_id: string;
  kind: 'gm' | 'player' | 'check' | 'system' | 'ending';
  payload_json: string;
  created_at: string;
};

export class GameRepository {
  constructor(private readonly db: SqliteDatabase) {}

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertOwner(row: OwnerRow): void {
    this.db
      .prepare(
        `INSERT INTO browser_owners (id, credential_hash, active_session_id, created_at)
         VALUES (@id, @credential_hash, @active_session_id, @created_at)`,
      )
      .run(row);
  }

  getOwnerByHash(hash: string): OwnerRow | undefined {
    return this.db
      .prepare(`SELECT * FROM browser_owners WHERE credential_hash = ?`)
      .get(hash) as OwnerRow | undefined;
  }

  getOwnerById(id: string): OwnerRow | undefined {
    return this.db
      .prepare(`SELECT * FROM browser_owners WHERE id = ?`)
      .get(id) as OwnerRow | undefined;
  }

  setActiveSession(ownerId: string, sessionId: string | null): void {
    this.db
      .prepare(`UPDATE browser_owners SET active_session_id = ? WHERE id = ?`)
      .run(sessionId, ownerId);
  }

  insertSession(row: SessionRow): void {
    this.db
      .prepare(
        `INSERT INTO sessions (
           id, owner_id, create_request_id, create_request_hash, revision, status,
           state_json, pending_operation_id, created_at, updated_at
         ) VALUES (
           @id, @owner_id, @create_request_id, @create_request_hash, @revision, @status,
           @state_json, @pending_operation_id, @created_at, @updated_at
         )`,
      )
      .run(row);
  }

  getSessionById(id: string): SessionRow | undefined {
    return this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(id) as SessionRow | undefined;
  }

  getSessionByCreateRequest(
    ownerId: string,
    createRequestId: string,
  ): SessionRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM sessions WHERE owner_id = ? AND create_request_id = ?`,
      )
      .get(ownerId, createRequestId) as SessionRow | undefined;
  }

  getActiveSessionForOwner(ownerId: string): SessionRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM sessions WHERE owner_id = ? AND status = 'active'`,
      )
      .get(ownerId) as SessionRow | undefined;
  }

  parseState(row: SessionRow): SessionState {
    return sessionStateSchema.parse(JSON.parse(row.state_json));
  }

  updateSession(row: {
    id: string;
    revision: number;
    status: SessionRow['status'];
    state_json: string;
    pending_operation_id: string | null;
    updated_at: string;
  }): number {
    const result = this.db
      .prepare(
        `UPDATE sessions
         SET revision = @revision,
             status = @status,
             state_json = @state_json,
             pending_operation_id = @pending_operation_id,
             updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(row);
    return result.changes;
  }

  casUpdateSession(row: {
    id: string;
    expectedRevision: number;
    expectedPending: string | null;
    revision: number;
    status: SessionRow['status'];
    state_json: string;
    pending_operation_id: string | null;
    updated_at: string;
  }): boolean {
    const result = this.db
      .prepare(
        `UPDATE sessions
         SET revision = @revision,
             status = @status,
             state_json = @state_json,
             pending_operation_id = @pending_operation_id,
             updated_at = @updated_at
         WHERE id = @id
           AND revision = @expectedRevision
           AND (
             (@expectedPending IS NULL AND pending_operation_id IS NULL)
             OR pending_operation_id = @expectedPending
           )`,
      )
      .run(row);
    return result.changes === 1;
  }

  setPendingOperation(
    sessionId: string,
    operationId: string | null,
    updatedAt: string,
  ): void {
    this.db
      .prepare(
        `UPDATE sessions SET pending_operation_id = ?, updated_at = ? WHERE id = ?`,
      )
      .run(operationId, updatedAt, sessionId);
  }

  insertOperation(row: OperationRow): void {
    this.db
      .prepare(
        `INSERT INTO operations (
           id, session_id, request_hash, command_json, base_revision, phase, resume_stage,
           proposal_json, resolution_json, result_json, error_code, lease_token, lease_until,
           provider_attempts, created_at, updated_at
         ) VALUES (
           @id, @session_id, @request_hash, @command_json, @base_revision, @phase, @resume_stage,
           @proposal_json, @resolution_json, @result_json, @error_code, @lease_token, @lease_until,
           @provider_attempts, @created_at, @updated_at
         )`,
      )
      .run(row);
  }

  getOperationById(id: string): OperationRow | undefined {
    return this.db
      .prepare(`SELECT * FROM operations WHERE id = ?`)
      .get(id) as OperationRow | undefined;
  }

  getUnfinishedOperation(sessionId: string): OperationRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM operations
         WHERE session_id = ?
           AND phase NOT IN ('committed', 'cancelled')`,
      )
      .get(sessionId) as OperationRow | undefined;
  }

  updateOperation(row: Partial<OperationRow> & { id: string; updated_at: string }): void {
    const entries = Object.entries(row).filter(([key]) => key !== 'id');
    const assignments = entries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db.prepare(`UPDATE operations SET ${assignments} WHERE id = @id`).run(row);
  }

  casUpdateOperation(args: {
    id: string;
    expectedToken: number;
    nowIso: string;
    fields: Partial<OperationRow>;
    updated_at: string;
  }): boolean {
    const assignments = Object.keys(args.fields)
      .map((key) => `${key} = @${key}`)
      .join(', ');
    const result = this.db
      .prepare(
        `UPDATE operations
         SET ${assignments}, updated_at = @updated_at
         WHERE id = @id
           AND lease_token = @expectedToken
           AND (lease_until IS NULL OR lease_until >= @nowIso)`,
      )
      .run({
        ...args.fields,
        id: args.id,
        expectedToken: args.expectedToken,
        nowIso: args.nowIso,
        updated_at: args.updated_at,
      });
    return result.changes === 1;
  }

  claimLease(args: {
    id: string;
    phase: OperationPhase;
    resume_stage: ResumeStage | null;
    lease_until: string;
    updated_at: string;
  }): number | null {
    const result = this.db
      .prepare(
        `UPDATE operations
         SET lease_token = lease_token + 1,
             lease_until = @lease_until,
             phase = @phase,
             resume_stage = @resume_stage,
             updated_at = @updated_at
         WHERE id = @id
         RETURNING lease_token`,
      )
      .get(args) as { lease_token: number } | undefined;
    return result?.lease_token ?? null;
  }

  invalidateLease(id: string, updatedAt: string): void {
    this.db
      .prepare(
        `UPDATE operations
         SET lease_token = lease_token + 1, lease_until = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(updatedAt, id);
  }

  insertMessage(row: Omit<MessageRow, 'seq'>): MessageRow {
    const info = this.db
      .prepare(
        `INSERT INTO messages (
           id, session_id, operation_id, scene_id, kind, payload_json, created_at
         ) VALUES (
           @id, @session_id, @operation_id, @scene_id, @kind, @payload_json, @created_at
         )`,
      )
      .run(row);
    return {
      ...row,
      seq: Number(info.lastInsertRowid),
    };
  }

  listMessages(sessionId: string, before: number | null, limit: number): MessageRow[] {
    if (before === null) {
      return this.db
        .prepare(
          `SELECT * FROM (
             SELECT * FROM messages WHERE session_id = ? ORDER BY seq DESC LIMIT ?
           ) ORDER BY seq ASC`,
        )
        .all(sessionId, limit) as MessageRow[];
    }
    return this.db
      .prepare(
        `SELECT * FROM (
           SELECT * FROM messages
           WHERE session_id = ? AND seq < ?
           ORDER BY seq DESC LIMIT ?
         ) ORDER BY seq ASC`,
      )
      .all(sessionId, before, limit) as MessageRow[];
  }

  latestMessages(sessionId: string, limit: number): MessageRow[] {
    return this.listMessages(sessionId, null, limit);
  }

  latestSeq(sessionId: string): number | null {
    const row = this.db
      .prepare(`SELECT MAX(seq) AS seq FROM messages WHERE session_id = ?`)
      .get(sessionId) as { seq: number | null };
    return row.seq;
  }
}
