import { db, uid, code8 } from './db.js';
import { summarize, generateQuestions } from './ai.js';
import { record } from './audit.js';

class Err extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const need = (row) => { if (!row) throw new Err(404, 'NOT_FOUND'); return row; };

// atomic unit of work — count-reads + state writes happen inside one transaction
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}

// ---- sessions (slice-level; production = JWT with pair_id claim) ----
const sessions = new Map();
export function resolve(token) {
  const s = token && sessions.get(token);
  if (!s) throw new Err(401, 'UNAUTHENTICATED');
  return s;
}

// ---- auth + pairing ----
export function createPair({ email, displayName }) {
  const pairId = uid(), userId = uid(), code = code8();
  db.prepare('INSERT INTO pairs(id,user_a,code,status) VALUES(?,?,?,?)').run(pairId, userId, code, 'pending');
  db.prepare('INSERT INTO users(id,email,pair_id,display_name) VALUES(?,?,?,?)').run(userId, email, pairId, displayName || 'A');
  record(pairId, 'pair', pairId, 'pair_created', { actor: userId });
  const token = uid(); sessions.set(token, { userId, pairId });
  return { pairId, pairCode: code, token, userId };
}
export function joinPair({ code, email, displayName }) {
  const pair = db.prepare("SELECT * FROM pairs WHERE code=? AND status='pending'").get(code);
  if (!pair) throw new Err(404, 'INVALID_CODE');
  if (pair.user_b) throw new Err(409, 'PAIR_FULL');
  const userId = uid();
  db.prepare("UPDATE pairs SET user_b=?, status='active', code=NULL WHERE id=?").run(userId, pair.id);
  db.prepare('INSERT INTO users(id,email,pair_id,display_name) VALUES(?,?,?,?)').run(userId, email, pair.id, displayName || 'B');
  record(pair.id, 'pair', pair.id, 'pair_joined', { actor: userId });
  const token = uid(); sessions.set(token, { userId, pairId: pair.id });
  return { pairId: pair.id, token, userId };
}

// ---- resources ----
export function listResources(s) {
  return db.prepare('SELECT * FROM resources WHERE pair_id=? ORDER BY rowid DESC').all(s.pairId);
}
export function createResource(s, b) {
  const id = uid();
  db.prepare('INSERT INTO resources(id,pair_id,title,type,stage,link,source_text,created_by) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, s.pairId, b.title, b.type || null, b.stage || null, b.link || null, b.sourceText || null, s.userId);
  record(s.pairId, 'resource', id, 'created', { actor: s.userId });
  return getResource(s, id).resource;
}
export function getResource(s, id) {
  const resource = need(db.prepare('SELECT * FROM resources WHERE id=? AND pair_id=?').get(id, s.pairId));
  const summary = db.prepare('SELECT * FROM summaries WHERE resource_id=?').get(id) || null;
  const questions = db.prepare('SELECT * FROM questions WHERE resource_id=? ORDER BY rowid').all(id);
  const decisions = db.prepare('SELECT * FROM decisions WHERE resource_id=? ORDER BY rowid').all(id);
  return { resource, summary, questions, decisions };
}

function markInProgress(s, resourceId) {
  const res = db.prepare("UPDATE resources SET status='in_progress' WHERE id=? AND status='not_started'").run(resourceId);
  if (res.changes) record(s.pairId, 'resource', resourceId, 'transition', { from: 'not_started', to: 'in_progress', actor: s.userId });
}

// ---- summary (AI) ----
export function generateSummary(s, resourceId) {
  const r = need(db.prepare('SELECT * FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  if (!r.source_text || !r.source_text.trim()) throw new Err(422, 'NEEDS_SOURCE_TEXT');
  const content = summarize(r.source_text);
  if (!content) throw new Err(502, 'AI_EMPTY');
  db.prepare(`INSERT INTO summaries(id,pair_id,resource_id,content,generated_by) VALUES(?,?,?,?, 'ai')
              ON CONFLICT(resource_id) DO UPDATE SET content=excluded.content`)
    .run(uid(), s.pairId, resourceId, content);
  record(s.pairId, 'resource', resourceId, 'summary_generated', { actor: s.userId });
  markInProgress(s, resourceId);
  return db.prepare('SELECT * FROM summaries WHERE resource_id=?').get(resourceId);
}

// ---- questions ----
export function generateQuestionsFor(s, resourceId) {
  need(db.prepare('SELECT id FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  const texts = generateQuestions();
  for (const text of texts) {
    const qid = uid();
    db.prepare('INSERT INTO questions(id,pair_id,resource_id,text) VALUES(?,?,?,?)').run(qid, s.pairId, resourceId, text);
    record(s.pairId, 'question', qid, 'created', { actor: s.userId });
  }
  markInProgress(s, resourceId);
  return db.prepare('SELECT * FROM questions WHERE resource_id=? ORDER BY rowid').all(resourceId);
}
export function addQuestion(s, resourceId, text) {
  need(db.prepare('SELECT id FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  const id = uid();
  db.prepare('INSERT INTO questions(id,pair_id,resource_id,text) VALUES(?,?,?,?)').run(id, s.pairId, resourceId, text);
  record(s.pairId, 'question', id, 'created', { actor: s.userId });
  markInProgress(s, resourceId);
  return db.prepare('SELECT * FROM questions WHERE id=?').get(id);
}

// ---- responses + reveal ----
function q_of(s, id) { return need(db.prepare('SELECT * FROM questions WHERE id=? AND pair_id=?').get(id, s.pairId)); }

export function submitResponse(s, questionId, text) {
  const q = q_of(s, questionId);
  if (!['open', 'answered_by_one', 'ready_to_reveal'].includes(q.state)) throw new Err(409, 'QUESTION_LOCKED');
  return tx(() => {
    db.prepare(`INSERT INTO responses(id,pair_id,question_id,user_id,text) VALUES(?,?,?,?,?)
                ON CONFLICT(question_id,user_id) DO UPDATE SET text=excluded.text`)
      .run(uid(), s.pairId, questionId, s.userId, text);
    record(s.pairId, 'question', questionId, 'response_submitted', { actor: s.userId });
    const n = db.prepare('SELECT count(*) c FROM responses WHERE question_id=?').get(questionId).c;
    if (n === 1) {
      const res = db.prepare("UPDATE questions SET state='answered_by_one', first_response_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND state='open'").run(questionId);
      if (res.changes) record(s.pairId, 'question', questionId, 'transition', { from: 'open', to: 'answered_by_one', actor: s.userId });
    } else if (n >= 2) {
      const res = db.prepare("UPDATE questions SET state='ready_to_reveal' WHERE id=? AND state='answered_by_one'").run(questionId);
      if (res.changes) record(s.pairId, 'question', questionId, 'transition', { from: 'answered_by_one', to: 'ready_to_reveal', actor: s.userId });
    }
    return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
  });
}

export function getResponses(s, questionId) {
  const q = q_of(s, questionId);
  const rows = db.prepare('SELECT user_id, text FROM responses WHERE question_id=?').all(questionId);
  const mine = rows.find((r) => r.user_id === s.userId) || null;
  const revealed = ['revealed', 'decided'].includes(q.state);
  const other = rows.find((r) => r.user_id !== s.userId) || null;
  return {
    questionState: q.state,
    mine: mine ? { text: mine.text } : null,
    partner: revealed && other ? { text: other.text } : null,
  };
}

export function reveal(s, questionId) {
  const q = q_of(s, questionId);
  if (['revealed', 'decided'].includes(q.state)) return q; // idempotent under reveal races
  const res = db.prepare("UPDATE questions SET state='revealed', reveal_method='both' WHERE id=? AND pair_id=? AND state='ready_to_reveal'").run(questionId, s.pairId);
  if (res.changes === 0) throw new Err(409, 'STATE_CONFLICT');
  record(s.pairId, 'question', questionId, 'transition', { from: 'ready_to_reveal', to: 'revealed', actor: s.userId, meta: { reveal_method: 'both' } });
  return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
}
export function forceReveal(s, questionId) {
  const q = q_of(s, questionId);
  if (['revealed', 'decided'].includes(q.state)) return q; // idempotent
  const res = db.prepare("UPDATE questions SET state='revealed', reveal_method='force', reveal_by=? WHERE id=? AND pair_id=? AND state IN ('answered_by_one','ready_to_reveal')").run(s.userId, questionId, s.pairId);
  if (res.changes === 0) throw new Err(409, 'NOTHING_TO_REVEAL');
  record(s.pairId, 'question', questionId, 'force_reveal', { from: q.state, to: 'revealed', actor: s.userId, meta: { reveal_method: 'force', forced_by: s.userId } });
  return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
}

// ---- decisions (human only) ----
export function listDecisions(s) {
  return db.prepare('SELECT * FROM decisions WHERE pair_id=? ORDER BY rowid DESC').all(s.pairId);
}
export function getDecision(s, id) {
  const decision = need(db.prepare('SELECT * FROM decisions WHERE id=? AND pair_id=?').get(id, s.pairId));
  const questions = db.prepare('SELECT q.* FROM questions q JOIN decision_questions dq ON dq.question_id=q.id WHERE dq.decision_id=?').all(id);
  const confirmations = db.prepare('SELECT user_id FROM decision_confirmations WHERE decision_id=?').all(id);
  const events = db.prepare('SELECT entity,entity_id,type,from_state,to_state,actor,meta,created_at FROM events WHERE pair_id=? AND entity=? AND entity_id=? ORDER BY rowid').all(s.pairId, 'decision', id);
  return { decision, questions, confirmations, events };
}
export function createDecision(s, b) {
  const { resourceId, statement, action, questionIds, idempotencyKey } = b || {};
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM decisions WHERE pair_id=? AND idempotency_key=?').get(s.pairId, idempotencyKey);
    if (existing) return existing; // dedupe retries / double-submit
  }
  if (!Array.isArray(questionIds) || questionIds.length === 0) throw new Err(422, 'NO_QUESTIONS_LINKED');
  const ph = questionIds.map(() => '?').join(',');
  const qs = db.prepare(`SELECT * FROM questions WHERE resource_id=? AND pair_id=? AND id IN (${ph})`).all(resourceId, s.pairId, ...questionIds);
  if (qs.length !== questionIds.length) throw new Err(422, 'INVALID_QUESTIONS');
  if (!qs.some((q) => ['revealed', 'decided'].includes(q.state))) throw new Err(409, 'NO_REVEALED_QUESTION');
  return tx(() => {
    const id = uid();
    db.prepare('INSERT INTO decisions(id,pair_id,resource_id,statement,action,created_by,idempotency_key) VALUES(?,?,?,?,?,?,?)')
      .run(id, s.pairId, resourceId, statement, action || null, s.userId, idempotencyKey || null);
    for (const qid of questionIds) db.prepare('INSERT INTO decision_questions(decision_id,question_id,pair_id) VALUES(?,?,?)').run(id, qid, s.pairId);
    record(s.pairId, 'decision', id, 'created', { actor: s.userId, meta: { resourceId, questionIds } });
    return db.prepare('SELECT * FROM decisions WHERE id=?').get(id);
  });
}
export function confirmDecision(s, decisionId) {
  const d = need(db.prepare('SELECT * FROM decisions WHERE id=? AND pair_id=?').get(decisionId, s.pairId));
  if (!['draft', 'revisited'].includes(d.state)) throw new Err(409, 'NOT_CONFIRMABLE');
  return tx(() => {
    db.prepare('INSERT OR IGNORE INTO decision_confirmations(decision_id,user_id,pair_id) VALUES(?,?,?)').run(decisionId, s.userId, s.pairId);
    record(s.pairId, 'decision', decisionId, 'confirmation', { actor: s.userId });
    const n = db.prepare('SELECT count(*) c FROM decision_confirmations WHERE decision_id=?').get(decisionId).c;
    if (n >= 2) {
      const r1 = db.prepare("UPDATE decisions SET state='confirmed' WHERE id=? AND state IN ('draft','revisited')").run(decisionId);
      if (r1.changes) record(s.pairId, 'decision', decisionId, 'transition', { from: d.state, to: 'confirmed', actor: s.userId });
      const qids = db.prepare("SELECT q.id id FROM questions q JOIN decision_questions dq ON dq.question_id=q.id WHERE dq.decision_id=? AND q.state='revealed'").all(decisionId);
      for (const { id } of qids) {
        db.prepare("UPDATE questions SET state='decided' WHERE id=?").run(id);
        record(s.pairId, 'question', id, 'transition', { from: 'revealed', to: 'decided', actor: s.userId });
      }
      const rr = db.prepare("UPDATE resources SET status='completed' WHERE id=? AND status='in_progress'").run(d.resource_id);
      if (rr.changes) record(s.pairId, 'resource', d.resource_id, 'transition', { from: 'in_progress', to: 'completed', actor: s.userId });
    }
    return db.prepare('SELECT * FROM decisions WHERE id=?').get(decisionId);
  });
}

// ---- event history ----
export function resourceEvents(s, resourceId) {
  need(db.prepare('SELECT id FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  return db.prepare(`SELECT entity,entity_id,type,from_state,to_state,actor,meta,created_at FROM events
    WHERE pair_id=? AND (
      (entity='resource' AND entity_id=?)
      OR (entity='question' AND entity_id IN (SELECT id FROM questions WHERE resource_id=?))
      OR (entity='decision' AND entity_id IN (SELECT id FROM decisions WHERE resource_id=?))
    ) ORDER BY rowid`).all(s.pairId, resourceId, resourceId, resourceId);
}
export function questionEvents(s, questionId) {
  need(db.prepare('SELECT id FROM questions WHERE id=? AND pair_id=?').get(questionId, s.pairId));
  return db.prepare('SELECT entity,entity_id,type,from_state,to_state,actor,meta,created_at FROM events WHERE pair_id=? AND entity=? AND entity_id=? ORDER BY rowid').all(s.pairId, 'question', questionId);
}

export { Err };
