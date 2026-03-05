/**
 * SQL CREATE statements for the entire Lumina schema.
 * Tables are created in dependency order.
 * sqlite-vec virtual table is gated behind vecAvailable flag.
 */

export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS user_profile (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    name       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    last_active_at TEXT
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    mode                   TEXT NOT NULL CHECK(mode IN ('prompted','freeform')),
    content                TEXT NOT NULL,
    guiding_question       TEXT,
    mood_emoji             TEXT,
    mood_inferred          REAL,
    activity_state_at_entry TEXT,
    embedding_status       TEXT NOT NULL DEFAULT 'pending' CHECK(embedding_status IN ('pending','done','failed')),
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memory_chunks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type      TEXT NOT NULL CHECK(source_type IN ('journal','conversation','summary')),
    source_id        INTEGER NOT NULL,
    chunk_index      INTEGER NOT NULL DEFAULT 0,
    content          TEXT NOT NULL,
    importance_score REAL NOT NULL DEFAULT 0.5,
    retrieval_count  INTEGER NOT NULL DEFAULT 0,
    last_retrieved_at TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    summarised_at  TEXT,
    summary_chunk_id INTEGER REFERENCES memory_chunks(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id     INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content             TEXT NOT NULL,
    retrieved_chunk_ids TEXT DEFAULT '[]',
    groundedness_score  REAL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mood_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    source           TEXT NOT NULL CHECK(source IN ('emoji_vibe','text_inference','activity_inference')),
    raw_value        TEXT NOT NULL,
    normalised_score REAL NOT NULL CHECK(normalised_score BETWEEN 0.0 AND 1.0),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name          TEXT NOT NULL,
    category          TEXT NOT NULL,
    window_title_hash TEXT,
    duration_seconds  INTEGER,
    started_at        TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS companion_core_memory (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    user_facts          TEXT NOT NULL DEFAULT '{}',
    user_patterns       TEXT NOT NULL DEFAULT '{}',
    relationship_notes  TEXT NOT NULL DEFAULT '{}',
    tone_calibration    TEXT NOT NULL DEFAULT '{"formal_casual":3,"directness":3,"humour":2,"checkin_frequency":"normal"}',
    last_updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    version             INTEGER NOT NULL DEFAULT 1,
    previous_versions   TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS ccm_proposals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    section          TEXT NOT NULL CHECK(section IN ('user_facts','user_patterns','relationship_notes','tone_calibration')),
    proposed_key     TEXT NOT NULL,
    proposed_value   TEXT NOT NULL,
    source_message_id INTEGER REFERENCES messages(id),
    status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL,
    trigger          TEXT NOT NULL CHECK(trigger IN ('scheduled','transition')),
    activity_state   TEXT,
    gate_1           TEXT CHECK(gate_1 IN ('pass','hold')),
    gate_2           TEXT CHECK(gate_2 IN ('pass','hold')),
    gate_3           TEXT CHECK(gate_3 IN ('pass','hold')),
    gate_4           TEXT CHECK(gate_4 IN ('pass','hold')),
    gate_5           TEXT CHECK(gate_5 IN ('pass','hold')),
    action_type      TEXT CHECK(action_type IN ('CELEBRATE','CHECKIN','NUDGE','SILENCE')),
    message_generated TEXT,
    user_response    TEXT CHECK(user_response IN ('engaged','dismissed','no_response')),
    langfuse_trace_id TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS llm_calls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    model            TEXT NOT NULL,
    prompt_tokens    INTEGER,
    completion_tokens INTEGER,
    duration_ms      INTEGER,
    context          TEXT CHECK(context IN ('chat','agent','groundedness','ccm_extraction')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS retrieval_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash       TEXT NOT NULL,
    chunk_ids        TEXT NOT NULL DEFAULT '[]',
    similarity_scores TEXT NOT NULL DEFAULT '[]',
    reranker_scores  TEXT NOT NULL DEFAULT '[]',
    duration_ms      INTEGER,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
`

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);
  CREATE INDEX IF NOT EXISTS idx_mood_logs_created_at ON mood_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_sessions_started_at ON activity_sessions(started_at);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_memory_chunks_source ON memory_chunks(source_type, source_id);
  CREATE INDEX IF NOT EXISTS idx_memory_chunks_importance ON memory_chunks(importance_score DESC);
  CREATE INDEX IF NOT EXISTS idx_ccm_proposals_status ON ccm_proposals(status);
  CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at);
`

export const CREATE_FTS5 = `
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts USING fts5(
    content,
    content='memory_chunks',
    content_rowid='id'
  );
`

export const CREATE_VEC_TABLE = `
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
    rowid INTEGER PRIMARY KEY,
    embedding float[768]
  );
`

export const CREATE_SCHEMA_VERSION = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL DEFAULT 0,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`
