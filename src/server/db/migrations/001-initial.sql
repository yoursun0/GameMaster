CREATE TABLE browser_owners (
  id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL UNIQUE,
  active_session_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES browser_owners(id),
  create_request_id TEXT NOT NULL,
  create_request_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status TEXT NOT NULL CHECK (status IN ('active','completed','abandoned')),
  state_json TEXT NOT NULL,
  pending_operation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id, create_request_id)
);

CREATE UNIQUE INDEX one_active_session_per_owner
  ON sessions(owner_id) WHERE status = 'active';

CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  request_hash TEXT NOT NULL,
  command_json TEXT NOT NULL,
  base_revision INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN (
    'interpreting','awaiting_confirmation','resolving','narrating',
    'retryable_error','committed','cancelled'
  )),
  resume_stage TEXT CHECK (resume_stage IN ('interpret','resolve','narrate')),
  proposal_json TEXT,
  resolution_json TEXT,
  result_json TEXT,
  error_code TEXT,
  lease_token INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  provider_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX one_unfinished_operation_per_session
  ON operations(session_id)
  WHERE phase NOT IN ('committed','cancelled');

CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  operation_id TEXT REFERENCES operations(id),
  scene_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('gm','player','check','system','ending')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX messages_by_session_seq ON messages(session_id, seq);
CREATE INDEX operations_by_session ON operations(session_id, created_at);
