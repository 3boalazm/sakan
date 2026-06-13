import { db, uid, code8 } from './db.js';
import { summarize, generateQuestions } from './ai.js';

class Err extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const need = (row) => { if (!row) throw new Err(404, 'NOT_FOUND'); return row; };

// ---- sessions (slice-level; production = JWT with pair_id claim) ----
const sessions = new Map(); // token -> { userId, pairId }
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
  return getResource(s, id).resource;
}
export function getResource(s, id) {
  const resource = need(db.prepare('SELECT * FROM resources WHERE id=? AND pair_id=?').get(id, s.pairId));
  const summary = db.prepare('SELECT * FROM summaries WHERE resource_id=?').get(id) || null;
  const questions = db.prepare('SELECT * FROM questions WHERE resource_id=? ORDER BY rowid').all(id);
  const decisions = db.prepare('SELECT * FROM decisions WHERE resource_id=? ORDER BY rowid').all(id);
  return { resource, summary, questions, decisions };
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
  db.prepare("UPDATE resources SET status='in_progress' WHERE id=? AND status='not_started'").run(resourceId);
  return db.prepare('SELECT * FROM summaries WHERE resource_id=?').get(resourceId);
}

// ---- questions ----
export function generateQuestionsFor(s, resourceId) {
  need(db.prepare('SELECT id FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  const texts = generateQuestions();
  for (const text of texts) db.prepare('INSERT INTO questions(id,pair_id,resource_id,text) VALUES(?,?,?,?)').run(uid(), s.pairId, resourceId, text);
  db.prepare("UPDATE resources SET status='in_progress' WHERE id=? AND status='not_started'").run(resourceId);
  return db.prepare('SELECT * FROM questions WHERE resource_id=? ORDER BY rowid').all(resourceId);
}
export function addQuestion(s, resourceId, text) {
  need(db.prepare('SELECT id FROM resources WHERE id=? AND pair_id=?').get(resourceId, s.pairId));
  const id = uid();
  db.prepare('INSERT INTO questions(id,pair_id,resource_id,text) VALUES(?,?,?,?)').run(id, s.pairId, resourceId, text);
  db.prepare("UPDATE resources SET status='in_progress' WHERE id=? AND status='not_started'").run(resourceId);
  return db.prepare('SELECT * FROM questions WHERE id=?').get(id);
}

// ---- responses + reveal ----
function q_of(s, id) { return need(db.prepare('SELECT * FROM questions WHERE id=? AND pair_id=?').get(id, s.pairId)); }

export function submitResponse(s, questionId, text) {
  const q = q_of(s, questionId);
  if (!['open', 'answered_by_one', 'ready_to_reveal'].includes(q.state)) throw new Err(409, 'QUESTION_LOCKED');
  db.prepare(`INSERT INTO responses(id,pair_id,question_id,user_id,text) VALUES(?,?,?,?,?)
              ON CONFLICT(question_id,user_id) DO UPDATE SET text=excluded.text`)
    .run(uid(), s.pairId, questionId, s.userId, text);
  const n = db.prepare('SELECT count(*) c FROM responses WHERE question_id=?').get(questionId).c;
  if (n === 1) db.prepare("UPDATE questions SET state='answered_by_one', first_response_at=datetime('now') WHERE id=? AND state='open'").run(questionId);
  else if (n >= 2) db.prepare("UPDATE questions SET state='ready_to_reveal' WHERE id=? AND state='answered_by_one'").run(questionId);
  return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
}

export function getResponses(s, questionId) {
  const q = q_of(s, questionId);
  const rows = db.prepare('SELECT user_id, text FROM responses WHERE question_id=?').all(questionId);
  const mine = rows.find(r => r.user_id === s.userId) || null;
  const revealed = ['revealed', 'decided'].includes(q.state);
  const other = rows.find(r => r.user_id !== s.userId) || null;
  return {
    questionState: q.state,
    mine: mine ? { text: mine.text } : null,
    partner: revealed && other ? { text: other.text } : null, // hidden until revealed
  };
}

export function reveal(s, questionId) {
  q_of(s, questionId);
  const res = db.prepare("UPDATE questions SET state='revealed', reveal_method='both' WHERE id=? AND pair_id=? AND state='ready_to_reveal'").run(questionId, s.pairId);
  if (res.changes === 0) throw new Err(409, 'STATE_CONFLICT'); // not both-answered yet
  return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
}
export function forceReveal(s, questionId) {
  q_of(s, questionId);
  const res = db.prepare("UPDATE questions SET state='revealed', reveal_method='force' WHERE id=? AND pair_id=? AND state IN ('answered_by_one','ready_to_reveal')").run(questionId, s.pairId);
  if (res.changes === 0) throw new Err(409, 'NOTHING_TO_REVEAL');
  return db.prepare('SELECT * FROM questions WHERE id=?').get(questionId);
}

// ---- decisions (human only) ----
export function listDecisions(s) {
  return db.prepare('SELECT * FROM decisions WHERE pair_id=? ORDER BY rowid DESC').all(s.pairId);
}
export function createDecision(s, { resourceId, statement, action, questionIds }) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) throw new Err(422, 'NO_QUESTIONS_LINKED');
  const ph = questionIds.map(() => '?').join(',');
  const qs = db.prepare(`SELECT * FROM questions WHERE resource_id=? AND pair_id=? AND id IN (${ph})`).all(resourceId, s.pairId, ...questionIds);
  if (qs.length !== questionIds.length) throw new Err(422, 'INVALID_QUESTIONS');
  if (!qs.some(q => ['revealed', 'decided'].includes(q.state))) throw new Err(409, 'NO_REVEALED_QUESTION');
  const id = uid();
  db.prepare('INSERT INTO decisions(id,pair_id,resource_id,statement,action,created_by) VALUES(?,?,?,?,?,?)')
    .run(id, s.pairId, resourceId, statement, action || null, s.userId);
  for (const qid of questionIds) db.prepare('INSERT INTO decision_questions(decision_id,question_id,pair_id) VALUES(?,?,?)').run(id, qid, s.pairId);
  return db.prepare('SELECT * FROM decisions WHERE id=?').get(id);
}
export function confirmDecision(s, decisionId) {
  const d = need(db.prepare('SELECT * FROM decisions WHERE id=? AND pair_id=?').get(decisionId, s.pairId));
  if (!['draft', 'revisited'].includes(d.state)) throw new Err(409, 'NOT_CONFIRMABLE');
  db.prepare('INSERT OR IGNORE INTO decision_confirmations(decision_id,user_id,pair_id) VALUES(?,?,?)').run(decisionId, s.userId, s.pairId);
  const n = db.prepare('SELECT count(*) c FROM decision_confirmations WHERE decision_id=?').get(decisionId).c;
  if (n >= 2) {
    db.prepare("UPDATE decisions SET state='confirmed' WHERE id=? AND state IN ('draft','revisited')").run(decisionId);
    db.prepare("UPDATE questions SET state='decided' WHERE state='revealed' AND id IN (SELECT question_id FROM decision_questions WHERE decision_id=?)").run(decisionId);
    db.prepare("UPDATE resources SET status='completed' WHERE id=? AND status='in_progress'").run(d.resource_id);
  }
  return db.prepare('SELECT * FROM decisions WHERE id=?').get(decisionId);
}

export { Err };
