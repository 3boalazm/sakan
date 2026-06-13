import { DatabaseSync } from 'node:sqlite';

// Built-in SQLite — no native dependency, no build step. For a private 2-person
// app this runs fine on any always-on Node host. IMPORTANT: point SAKAN_DB at a
// file on a PERSISTENT disk (e.g. /data/sakan.db), or data resets on redeploy.
export const db = new DatabaseSync(process.env.SAKAN_DB || 'sakan.db');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY, user_a TEXT NOT NULL, user_b TEXT,
  code TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL,
  pair_id TEXT NOT NULL REFERENCES pairs(id), display_name TEXT
);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL, title TEXT NOT NULL,
  type TEXT, stage TEXT, link TEXT, source_text TEXT,
  status TEXT NOT NULL DEFAULT 'not_started', created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL,
  resource_id TEXT NOT NULL UNIQUE REFERENCES resources(id),
  content TEXT NOT NULL, generated_by TEXT NOT NULL DEFAULT 'ai'
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  text TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open',
  first_response_at TEXT, reveal_method TEXT
);
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  user_id TEXT NOT NULL, text TEXT NOT NULL,
  UNIQUE(question_id, user_id)
);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  statement TEXT NOT NULL, action TEXT,
  state TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS decision_questions (
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  pair_id TEXT NOT NULL, PRIMARY KEY (decision_id, question_id)
);
CREATE TABLE IF NOT EXISTS decision_confirmations (
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  user_id TEXT NOT NULL, pair_id TEXT NOT NULL,
  PRIMARY KEY (decision_id, user_id)
);
CREATE TABLE IF NOT EXISTS state_transitions (
  entity TEXT, from_state TEXT, to_state TEXT,
  PRIMARY KEY (entity, from_state, to_state)
);
`);

// The state machine's single source of truth (allow-list).
const T = [
  ['resource','not_started','in_progress'], ['resource','in_progress','completed'],
  ['resource','completed','in_progress'],
  ['question','open','answered_by_one'], ['question','answered_by_one','ready_to_reveal'],
  ['question','answered_by_one','revealed'], ['question','ready_to_reveal','revealed'],
  ['question','revealed','decided'], ['question','decided','revealed'],
  ['decision','draft','confirmed'], ['decision','confirmed','revisited'],
  ['decision','revisited','confirmed'],
];
const ins = db.prepare('INSERT OR IGNORE INTO state_transitions VALUES (?,?,?)');
for (const t of T) ins.run(...t);

// Validator triggers: ANY illegal state change is rejected, from any code path.
db.exec(`
CREATE TRIGGER IF NOT EXISTS guard_resource BEFORE UPDATE OF status ON resources
WHEN OLD.status <> NEW.status AND NOT EXISTS (
  SELECT 1 FROM state_transitions WHERE entity='resource' AND from_state=OLD.status AND to_state=NEW.status)
BEGIN SELECT RAISE(ABORT,'invalid resource transition'); END;

CREATE TRIGGER IF NOT EXISTS guard_question BEFORE UPDATE OF state ON questions
WHEN OLD.state <> NEW.state AND NOT EXISTS (
  SELECT 1 FROM state_transitions WHERE entity='question' AND from_state=OLD.state AND to_state=NEW.state)
BEGIN SELECT RAISE(ABORT,'invalid question transition'); END;

CREATE TRIGGER IF NOT EXISTS guard_decision BEFORE UPDATE OF state ON decisions
WHEN OLD.state <> NEW.state AND NOT EXISTS (
  SELECT 1 FROM state_transitions WHERE entity='decision' AND from_state=OLD.state AND to_state=NEW.state)
BEGIN SELECT RAISE(ABORT,'invalid decision transition'); END;
`);

// ---- Hardening additions (audit log, immutability, force-reveal storage) ----
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, pair_id TEXT NOT NULL,
  entity TEXT NOT NULL, entity_id TEXT NOT NULL, type TEXT NOT NULL,
  from_state TEXT, to_state TEXT, actor TEXT, meta TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events ON events(pair_id, entity, entity_id, id);

-- a confirmed Decision is immutable (content cannot change; cannot be deleted)
CREATE TRIGGER IF NOT EXISTS lock_confirmed_decision BEFORE UPDATE ON decisions
WHEN OLD.state='confirmed' AND (NEW.statement<>OLD.statement OR IFNULL(NEW.action,'')<>IFNULL(OLD.action,''))
BEGIN SELECT RAISE(ABORT,'decision immutable after confirmed'); END;

CREATE TRIGGER IF NOT EXISTS no_delete_confirmed_decision BEFORE DELETE ON decisions
WHEN OLD.state='confirmed'
BEGIN SELECT RAISE(ABORT,'cannot delete confirmed decision'); END;
`);

// additive column migrations (safe to re-run; works on existing DBs)
function addColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}
addColumn('questions', 'reveal_by', 'TEXT');          // who triggered a force-reveal
addColumn('decisions', 'idempotency_key', 'TEXT');     // dedupe duplicate creation
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_idem
         ON decisions(pair_id, idempotency_key) WHERE idempotency_key IS NOT NULL;`);

export const uid = () => globalThis.crypto.randomUUID();
export const code8 = () => uid().replace(/-/g, '').slice(0, 8).toUpperCase();
