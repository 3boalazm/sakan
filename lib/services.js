import { db, uid, code8 } from './firebase.js';
import { CONTENT } from './content.js';
import crypto from 'node:crypto';

function normEmail(e) { return String(e || '').trim().toLowerCase(); }
function hashPw(pw) { const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return salt + ':' + h; }
function verifyPw(pw, stored) {
  try { const [salt, h] = String(stored || '').split(':'); if (!salt || !h) return false;
    const calc = crypto.scryptSync(String(pw), salt, 32); const hb = Buffer.from(h, 'hex');
    return calc.length === hb.length && crypto.timingSafeEqual(calc, hb); } catch { return false; }
}
function validCreds(email, pw) {
  const e = normEmail(email);
  if (!e || !e.includes('@') || e.length < 4) throw new Err(400, 'BAD_EMAIL');
  if (!pw || String(pw).length < 4) throw new Err(400, 'WEAK_PASSWORD');
  return e;
}
import { assertTransition } from './sm.js';
import { summarize, generateQuestions } from './ai.js';

class Err extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const need = (v) => { if (!v) throw new Err(404, 'NOT_FOUND'); return v; };
const C = (name) => db.collection(name);

async function record(pairId, entity, entityId, type, { from = null, to = null, actor = null, meta = null } = {}) {
  await C('events').add({ pairId, entity, entityId, type, from, to, actor, meta: meta || null, createdAt: Date.now() });
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: type, pairId, entity, entityId, from, to, actor, ...(meta || {}) }));
}

// ---- sessions ----
export async function resolve(token) {
  if (!token) throw new Err(401, 'UNAUTHENTICATED');
  const snap = await C('sessions').doc(token).get();
  if (!snap.exists) throw new Err(401, 'UNAUTHENTICATED');
  const d = snap.data();
  return { userId: d.userId, pairId: d.pairId };
}

// ---- auth + pairing ----
export async function createPair({ email, password, displayName }) {
  const e = validCreds(email, password);
  if ((await C('emailIndex').doc(e).get()).exists) throw new Err(409, 'EMAIL_TAKEN');
  const pairId = uid(), userId = uid(), code = code8(), token = uid();
  await C('pairs').doc(pairId).set({ userA: userId, userB: null, code, status: 'pending', createdAt: Date.now() });
  await C('pairCodes').doc(code).set({ pairId });
  await C('users').doc(userId).set({ email: e, pairId, displayName: displayName || 'A' });
  await C('emailIndex').doc(e).set({ userId, pairId, passwordHash: hashPw(password) });
  await C('sessions').doc(token).set({ userId, pairId });
  await record(pairId, 'pair', pairId, 'pair_created', { actor: userId });
  return { pairId, pairCode: code, token, userId, displayName: displayName || 'A' };
}
export async function joinPair({ code, email, password, displayName }) {
  const e = validCreds(email, password);
  const codeSnap = await C('pairCodes').doc(code).get();
  if (!codeSnap.exists) throw new Err(404, 'INVALID_CODE');
  if ((await C('emailIndex').doc(e).get()).exists) throw new Err(409, 'EMAIL_TAKEN');
  const { pairId } = codeSnap.data();
  const pairRef = C('pairs').doc(pairId);
  const pair = (await pairRef.get()).data();
  if (pair.userB) throw new Err(409, 'PAIR_FULL');
  const userId = uid(), token = uid();
  await pairRef.update({ userB: userId, status: 'active', code: null });
  await C('pairCodes').doc(code).delete();
  await C('users').doc(userId).set({ email: e, pairId, displayName: displayName || 'B' });
  await C('emailIndex').doc(e).set({ userId, pairId, passwordHash: hashPw(password) });
  await C('sessions').doc(token).set({ userId, pairId });
  await record(pairId, 'pair', pairId, 'pair_joined', { actor: userId });
  return { pairId, token, userId, displayName: displayName || 'B' };
}
// تسجيل الدخول لحساب موجود — يرجّع توكن جديد مربوط بنفس المستخدم والميثاق
export async function login({ email, password }) {
  const e = normEmail(email);
  const idx = await C('emailIndex').doc(e).get();
  if (!idx.exists || !verifyPw(password, idx.data().passwordHash)) throw new Err(401, 'BAD_CREDENTIALS');
  const { userId, pairId } = idx.data();
  const token = uid();
  await C('sessions').doc(token).set({ userId, pairId });
  const uSnap = await C('users').doc(userId).get();
  const pSnap = await C('pairs').doc(pairId).get();
  return { token, userId, pairId, displayName: uSnap.exists ? uSnap.data().displayName : null, pairCode: pSnap.exists ? (pSnap.data().code || null) : null };
}

// ---- resources ----
async function partnerId(s) {
  const p = (await C('pairs').doc(s.pairId).get()).data() || {};
  return p.userA === s.userId ? (p.userB || null) : (p.userA || null);
}
async function progressMap(s) {
  const snap = await C('progress').where('pairId', '==', s.pairId).get();
  const map = {};
  snap.docs.forEach((d) => { const x = d.data(); (map[x.resourceId] = map[x.resourceId] || {})[x.userId] = x.status; });
  return map;
}
function attachProg(map, pid, s, resourceId) {
  const pr = map[resourceId] || {};
  return { mine: pr[s.userId] || 'not_started', partner: (pid && pr[pid]) || 'not_started' };
}
export async function listResources(s) {
  const snap = await C('resources').where('pairId', '==', s.pairId).get();
  const pm = await progressMap(s); const pid = await partnerId(s);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), prog: attachProg(pm, pid, s, d.id) })).sort((a, b) => b.createdAt - a.createdAt);
}
// per-partner watch progress (private alignment signal — not social, no tracking history)
export async function setProgress(s, resourceId, status) {
  if (!['not_started', 'in_progress', 'completed'].includes(status)) throw new Err(400, 'BAD_STATUS');
  await resourceInPair(s, resourceId);
  await C('progress').doc(resourceId + '_' + s.userId).set({ pairId: s.pairId, resourceId, userId: s.userId, status, updatedAt: Date.now() });
  const pm = await progressMap(s); const pid = await partnerId(s);
  await record(s.pairId, 'resource', resourceId, 'progress', { actor: s.userId, meta: { status } });
  return { ok: true, prog: attachProg(pm, pid, s, resourceId) };
}
// shared priority (an agreement on what matters — stored on the pair-scoped resource)
export async function setPriority(s, resourceId, priority) {
  if (!['high', 'medium', 'later'].includes(priority)) throw new Err(400, 'BAD_PRIORITY');
  await resourceInPair(s, resourceId);
  await C('resources').doc(resourceId).update({ priority });
  return { ok: true, priority };
}
export async function setCategory(s, resourceId, category) {
  if (!['khotouba', 'zawaj', 'baad', 'tarbiya'].includes(category)) throw new Err(400, 'BAD_CATEGORY');
  await resourceInPair(s, resourceId);
  await C('resources').doc(resourceId).update({ category });
  return { ok: true, category };
}
async function youtubeMeta(link) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(link), { signal: AbortSignal.timeout(4500) });
    if (!r.ok) return null;
    const d = await r.json();
    return { title: d.title || null, thumbnail: d.thumbnail_url || null, author: d.author_name || null };
  } catch { return null; }
}
function ytId(link) { const m = (link || '').match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,})/); return m ? m[1] : null; }

export async function createResource(s, b) {
  const id = uid();
  let title = b.title, thumbnail = null;
  if (b.link && /youtu\.?be/.test(b.link)) {
    const meta = await youtubeMeta(b.link);                 // real title + thumb (server-side; no CORS)
    if (meta) {
      if (!title || /^(فيديو|قائمة تشغيل)\s·/.test(title)) title = meta.title || title;
      thumbnail = meta.thumbnail;
    }
    if (!thumbnail) { const vid = ytId(b.link); if (vid) thumbnail = 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg'; }
  }
  await C('resources').doc(id).set({
    pairId: s.pairId, title: title || b.link || 'مورد', type: b.type || null, stage: (b.stage ?? null),
    priority: b.priority || null, speaker: b.speaker || null, episodes: b.episodes || null, purpose: b.purpose || null,
    link: b.link || null, thumbnail: thumbnail || null, sourceText: b.sourceText || null, status: 'not_started',
    createdBy: s.userId, createdAt: Date.now(),
  });
  await record(s.pairId, 'resource', id, 'created', { actor: s.userId });
  return (await getResource(s, id)).resource;
}
async function resourceInPair(s, id) {
  const snap = await C('resources').doc(id).get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  return { id, ...snap.data() };
}
export async function getResource(s, id) {
  const resource = await resourceInPair(s, id);
  const pm = await progressMap(s); const pid = await partnerId(s);
  resource.prog = attachProg(pm, pid, s, id);
  const sumSnap = await C('summaries').doc(id).get();
  const summary = sumSnap.exists ? { id, ...sumSnap.data() } : null;
  const qSnap = await C('questions').where('resourceId', '==', id).get();
  const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
  const dSnap = await C('decisions').where('resourceId', '==', id).get();
  const decisions = dSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
  return { resource, summary, questions, decisions };
}
async function markInProgress(s, resourceId) {
  const ref = C('resources').doc(resourceId);
  const snap = await ref.get();
  if (snap.exists && snap.data().status === 'not_started') {
    assertTransition('resource', 'not_started', 'in_progress');
    await ref.update({ status: 'in_progress' });
    await record(s.pairId, 'resource', resourceId, 'transition', { from: 'not_started', to: 'in_progress', actor: s.userId });
  }
}

// ---- summary (AI) ----
export async function generateSummary(s, resourceId) {
  const r = await resourceInPair(s, resourceId);
  if (!r.sourceText || !r.sourceText.trim()) throw new Err(422, 'NEEDS_SOURCE_TEXT');
  const content = summarize(r.sourceText);
  if (!content) throw new Err(502, 'AI_EMPTY');
  await C('summaries').doc(resourceId).set({ pairId: s.pairId, resourceId, content, generatedBy: 'ai' });
  await record(s.pairId, 'resource', resourceId, 'summary_generated', { actor: s.userId });
  await markInProgress(s, resourceId);
  return { id: resourceId, ...(await C('summaries').doc(resourceId).get()).data() };
}

// ---- questions ----
export async function generateQuestionsFor(s, resourceId) {
  await resourceInPair(s, resourceId);
  const base = Date.now();
  const texts = generateQuestions();
  for (let i = 0; i < texts.length; i++) {
    const qid = uid();
    await C('questions').doc(qid).set({ pairId: s.pairId, resourceId, text: texts[i], state: 'open', responseCount: 0, order: base + i, createdAt: base + i });
    await record(s.pairId, 'question', qid, 'created', { actor: s.userId });
  }
  await markInProgress(s, resourceId);
  return (await getResource(s, resourceId)).questions;
}
export async function addQuestion(s, resourceId, text) {
  await resourceInPair(s, resourceId);
  const id = uid(), now = Date.now();
  await C('questions').doc(id).set({ pairId: s.pairId, resourceId, text, state: 'open', responseCount: 0, order: now, createdAt: now });
  await record(s.pairId, 'question', id, 'created', { actor: s.userId });
  await markInProgress(s, resourceId);
  return { id, ...(await C('questions').doc(id).get()).data() };
}

// ---- responses + reveal ----
export async function submitResponse(s, questionId, text) {
  const qRef = C('questions').doc(questionId);
  const rRef = C('responses').doc(`${questionId}_${s.userId}`);
  const out = await db.runTransaction(async (tx) => {
    const qSnap = await tx.get(qRef);
    if (!qSnap.exists || qSnap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
    const q = qSnap.data();
    if (!['open', 'answered_by_one', 'ready_to_reveal'].includes(q.state)) throw new Err(409, 'QUESTION_LOCKED');
    const rSnap = await tx.get(rRef);
    const isNew = !rSnap.exists;
    const count = (q.responseCount || 0) + (isNew ? 1 : 0);
    let to = null;
    if (count === 1 && q.state === 'open') to = 'answered_by_one';
    else if (count >= 2 && q.state === 'answered_by_one') to = 'ready_to_reveal';
    tx.set(rRef, { pairId: s.pairId, questionId, userId: s.userId, text });
    const upd = { responseCount: count };
    if (to) { assertTransition('question', q.state, to); upd.state = to; if (to === 'answered_by_one') upd.firstResponseAt = Date.now(); }
    tx.update(qRef, upd);
    return { from: q.state, to };
  });
  await record(s.pairId, 'question', questionId, 'response_submitted', { actor: s.userId });
  if (out.to) await record(s.pairId, 'question', questionId, 'transition', { from: out.from, to: out.to, actor: s.userId });
  return { id: questionId, ...(await qRef.get()).data() };
}

export async function getResponses(s, questionId) {
  const qSnap = await C('questions').doc(questionId).get();
  if (!qSnap.exists || qSnap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  const q = qSnap.data();
  const rs = await C('responses').where('questionId', '==', questionId).get();
  const rows = rs.docs.map((d) => d.data());
  const mine = rows.find((r) => r.userId === s.userId) || null;
  const other = rows.find((r) => r.userId !== s.userId) || null;
  const revealed = ['revealed', 'decided'].includes(q.state);
  return { questionState: q.state, mine: mine ? { text: mine.text } : null, partner: revealed && other ? { text: other.text } : null };
}

export async function reveal(s, questionId) {
  const ref = C('questions').doc(questionId);
  const out = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
    const q = snap.data();
    if (['revealed', 'decided'].includes(q.state)) return { already: true };
    if (q.state !== 'ready_to_reveal') throw new Err(409, 'STATE_CONFLICT');
    assertTransition('question', 'ready_to_reveal', 'revealed');
    tx.update(ref, { state: 'revealed', revealMethod: 'both' });
    return { already: false };
  });
  if (!out.already) await record(s.pairId, 'question', questionId, 'transition', { from: 'ready_to_reveal', to: 'revealed', actor: s.userId, meta: { reveal_method: 'both' } });
  return { id: questionId, ...(await ref.get()).data() };
}
export async function forceReveal(s, questionId) {
  const ref = C('questions').doc(questionId);
  const out = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
    const q = snap.data();
    if (['revealed', 'decided'].includes(q.state)) return { already: true };
    if (!['answered_by_one', 'ready_to_reveal'].includes(q.state)) throw new Err(409, 'NOTHING_TO_REVEAL');
    assertTransition('question', q.state, 'revealed');
    tx.update(ref, { state: 'revealed', revealMethod: 'force', revealBy: s.userId });
    return { already: false, from: q.state };
  });
  if (!out.already) await record(s.pairId, 'question', questionId, 'force_reveal', { from: out.from, to: 'revealed', actor: s.userId, meta: { reveal_method: 'force', forced_by: s.userId } });
  return { id: questionId, ...(await ref.get()).data() };
}

// ---- decisions (human only) ----
export async function listDecisions(s) {
  const snap = await C('decisions').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
}
export async function getDecision(s, id) {
  const snap = await C('decisions').doc(id).get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  const decision = { id, ...snap.data() };
  const dq = await C('decisionQuestions').where('decisionId', '==', id).get();
  const questions = dq.docs.map((d) => d.data().questionId);
  const cf = await C('decisionConfirmations').where('decisionId', '==', id).get();
  const confirmations = cf.docs.map((d) => d.data().userId);
  return { decision, questions, confirmations };
}
export async function createDecision(s, b) {
  const { resourceId, statement, action, questionIds, idempotencyKey, context, category, reviewDate } = b || {};
  if (idempotencyKey) {
    const idemRef = C('decisionIdem').doc(`${s.pairId}_${idempotencyKey}`);
    const ex = await idemRef.get();
    if (ex.exists) { const d = await C('decisions').doc(ex.data().decisionId).get(); return { id: d.id, ...d.data() }; }
  }
  if (!Array.isArray(questionIds) || !questionIds.length) throw new Err(422, 'NO_QUESTIONS_LINKED');
  const qDocs = await Promise.all(questionIds.map((id) => C('questions').doc(id).get()));
  if (qDocs.some((d) => !d.exists || d.data().pairId !== s.pairId || d.data().resourceId !== resourceId)) throw new Err(422, 'INVALID_QUESTIONS');
  if (!qDocs.some((d) => ['revealed', 'decided'].includes(d.data().state))) throw new Err(409, 'NO_REVEALED_QUESTION');
  const id = uid();
  await C('decisions').doc(id).set({ pairId: s.pairId, resourceId, statement, action: action || null, context: context || null, category: category || null, reviewDate: reviewDate || null, reviewed: false, state: 'draft', createdBy: s.userId, confirmCount: 0, idempotencyKey: idempotencyKey || null, createdAt: Date.now() });
  for (const qid of questionIds) await C('decisionQuestions').doc(`${id}_${qid}`).set({ pairId: s.pairId, decisionId: id, questionId: qid });
  if (idempotencyKey) await C('decisionIdem').doc(`${s.pairId}_${idempotencyKey}`).set({ decisionId: id });
  await record(s.pairId, 'decision', id, 'created', { actor: s.userId, meta: { resourceId, questionIds } });
  return { id, ...(await C('decisions').doc(id).get()).data() };
}
export async function confirmDecision(s, decisionId) {
  const dRef = C('decisions').doc(decisionId);
  const out = await db.runTransaction(async (tx) => {
    const dSnap = await tx.get(dRef);
    if (!dSnap.exists || dSnap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
    const d = dSnap.data();
    if (!['draft', 'revisited'].includes(d.state)) throw new Err(409, 'NOT_CONFIRMABLE');
    const cRef = C('decisionConfirmations').doc(`${decisionId}_${s.userId}`);
    const cSnap = await tx.get(cRef);
    const isNew = !cSnap.exists;
    const count = (d.confirmCount || 0) + (isNew ? 1 : 0);
    tx.set(cRef, { pairId: s.pairId, decisionId, userId: s.userId });
    const upd = { confirmCount: count };
    let confirmed = false;
    if (count >= 2 && ['draft', 'revisited'].includes(d.state)) { assertTransition('decision', d.state, 'confirmed'); upd.state = 'confirmed'; confirmed = true; }
    tx.update(dRef, upd);
    return { confirmed, from: d.state, resourceId: d.resource_id || d.resourceId };
  });
  await record(s.pairId, 'decision', decisionId, 'confirmation', { actor: s.userId });
  if (out.confirmed) {
    await record(s.pairId, 'decision', decisionId, 'transition', { from: out.from, to: 'confirmed', actor: s.userId });
    // cascade: linked questions revealed -> decided, resource -> completed
    const dq = await C('decisionQuestions').where('decisionId', '==', decisionId).get();
    for (const doc of dq.docs) {
      const qid = doc.data().questionId;
      const qRef = C('questions').doc(qid);
      const q = (await qRef.get()).data();
      if (q && q.state === 'revealed') { assertTransition('question', 'revealed', 'decided'); await qRef.update({ state: 'decided' }); await record(s.pairId, 'question', qid, 'transition', { from: 'revealed', to: 'decided', actor: s.userId }); }
    }
    const rRef = C('resources').doc(out.resourceId);
    const r = (await rRef.get()).data();
    if (r && r.status === 'in_progress') { assertTransition('resource', 'in_progress', 'completed'); await rRef.update({ status: 'completed' }); await record(s.pairId, 'resource', out.resourceId, 'transition', { from: 'in_progress', to: 'completed', actor: s.userId }); }
  }
  return { id: decisionId, ...(await dRef.get()).data() };
}

// ---- event history ----
export async function questionEvents(s, questionId) {
  const qSnap = await C('questions').doc(questionId).get();
  if (!qSnap.exists || qSnap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  const snap = await C('events').where('pairId', '==', s.pairId).where('entity', '==', 'question').where('entityId', '==', questionId).get();
  return snap.docs.map((d) => d.data()).sort((a, b) => a.createdAt - b.createdAt);
}
export async function resourceEvents(s, resourceId) {
  await resourceInPair(s, resourceId);
  const qSnap = await C('questions').where('resourceId', '==', resourceId).get();
  const dSnap = await C('decisions').where('resourceId', '==', resourceId).get();
  const ids = new Set([resourceId, ...qSnap.docs.map((d) => d.id), ...dSnap.docs.map((d) => d.id)]);
  const all = await C('events').where('pairId', '==', s.pairId).get();
  return all.docs.map((d) => d.data()).filter((e) => ids.has(e.entityId)).sort((a, b) => a.createdAt - b.createdAt);
}


export async function listMyJourney(s, limit = 60) {
  // جيب events بتاعتي أنا بس (actor === userId) — الطرف الآخر ميشوفهاش
  let snap;
  try {
    snap = await C('events')
      .where('pairId', '==', s.pairId)
      .where('actor', '==', s.userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
  } catch (err) {
    // fallback لو مش عنده composite index
    snap = await C('events')
      .where('pairId', '==', s.pairId)
      .get();
  }

  // جيب عناوين الـ resources
  const resSnap = await C('resources').where('pairId', '==', s.pairId).get();
  const resMap = {};
  resSnap.docs.forEach(d => { resMap[d.id] = d.data().title || '—'; });

  let events = snap.docs.map(d => {
    const e = d.data();
    // في حالة الـ fallback: فلتر actor يدوياً
    if (e.actor && e.actor !== s.userId) return null;
    const title = resMap[e.entityId] || resMap[(e.meta && e.meta.resourceId)] || null;
    return {
      id:        d.id,
      entity:    e.entity,
      type:      e.type,
      isMine:    true,          // دايماً true — رحلتك إنت بس
      from:      e.from || null,
      to:        e.to   || null,
      meta:      e.meta || null,
      title,
      createdAt: e.createdAt,
    };
  }).filter(Boolean);

  // ترتيب في حالة الـ fallback (الأحدث أولاً)
  events.sort((a, b) => b.createdAt - a.createdAt);
  if (events.length > limit) events = events.slice(0, limit);

  return { events, myId: s.userId };
}

export { Err };

// ============================================================
// فيز 2 — التنظيم العملي (المهام / الميزانية / المشتريات)
// نفس نمط الباك-إند: كل مستند فيه pairId، وكل قراءة/كتابة مقيّدة به.
// ============================================================
const ownedDoc = async (name, id, s) => {
  const ref = C(name).doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  return ref;
};

// ---- tasks (مخطّط الفرح / المهام) ----
export async function listTasks(s) {
  const snap = await C('tasks').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
}
export async function createTask(s, b) {
  const id = uid();
  const owner = ['m', 'd', 'both'].includes(b.owner) ? b.owner : 'both';
  await C('tasks').doc(id).set({ pairId: s.pairId, title: (b.title || 'مهمة').slice(0, 300), owner, due: b.due || null, done: false, createdBy: s.userId, createdAt: Date.now() });
  await record(s.pairId, 'task', id, 'created', { actor: s.userId });
  return { id, ...(await C('tasks').doc(id).get()).data() };
}
export async function toggleTask(s, id) {
  const ref = await ownedDoc('tasks', id, s);
  await ref.update({ done: !(await ref.get()).data().done });
  return { id, ...(await ref.get()).data() };
}
export async function deleteTask(s, id) { const ref = await ownedDoc('tasks', id, s); await ref.delete(); return { ok: true }; }

// ---- budget (الميزانية المشتركة) ----
export async function listBudget(s) {
  const snap = await C('budget').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
}
export async function createBudgetItem(s, b) {
  const id = uid();
  await C('budget').doc(id).set({ pairId: s.pairId, label: (b.label || 'بند').slice(0, 200), cat: b.cat || null, planned: Number(b.planned) || 0, paid: Number(b.paid) || 0, createdBy: s.userId, createdAt: Date.now() });
  await record(s.pairId, 'budget', id, 'created', { actor: s.userId });
  return { id, ...(await C('budget').doc(id).get()).data() };
}
export async function payBudgetItem(s, id, amount) {
  const ref = await ownedDoc('budget', id, s);
  const cur = await ref.get();
  await ref.update({ paid: (Number(cur.data().paid) || 0) + (Number(amount) || 0) });
  return { id, ...(await ref.get()).data() };
}
export async function deleteBudgetItem(s, id) { const ref = await ownedDoc('budget', id, s); await ref.delete(); return { ok: true }; }

// ---- shopping (قائمة المشتريات الحيّة) ----
export async function listShopping(s) {
  const snap = await C('shopping').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
}
export async function createShoppingItem(s, b) {
  const id = uid();
  await C('shopping').doc(id).set({ pairId: s.pairId, text: (b.text || '').slice(0, 200), done: false, createdBy: s.userId, createdAt: Date.now() });
  return { id, ...(await C('shopping').doc(id).get()).data() };
}
export async function toggleShoppingItem(s, id) {
  const ref = await ownedDoc('shopping', id, s);
  await ref.update({ done: !(await ref.get()).data().done });
  return { id, ...(await ref.get()).data() };
}
export async function deleteShoppingItem(s, id) { const ref = await ownedDoc('shopping', id, s); await ref.delete(); return { ok: true }; }

// ============================================================
// فيز 3 — الرحلات والمراحل + بذر المنهج (من خريطة_طريق_سكن.xlsx)
// بيانات مؤكّدة (10 دورات + 10 كتب). تُكمَّل بإضافة سطور هنا عند توفّر الملف الكامل.
// ============================================================
const CURRICULUM = [
  // الدورات
  { type:'course', stage:0, order:1,  priority:'high', title:'الميثاق الغليظ والزواج', speaker:'الشيخ يعقوب', episodes:18, link:'https://t.me/elzwag/3',   purpose:'تأصيل مفهوم الزواج كميثاق غليظ وعبادة ومقصد شرعي.' },
  { type:'course', stage:0, order:2,  priority:'high', title:'الميثاق الغليظ', speaker:'د. إبراهيم الشربيني', episodes:9, link:'https://t.me/elzwag/189', purpose:'ترسيخ مفهوم الميثاق بزاوية وعمق مختلفين.' },
  { type:'course', stage:0, order:3,  priority:'high', title:'من أجل زواج راشد', speaker:'الشيخ خالد السبت', episodes:5, link:'https://t.me/elzwag/169', purpose:'الرشد في قرار الزواج ومقاصده.' },
  { type:'course', stage:0, order:4,  priority:'high', title:'إضاءات في طريق الزواج', speaker:'د. محمد بن إبراهيم', episodes:2, link:'https://t.me/elzwag/199', purpose:'إضاءات موجزة عامة على طريق الزواج.' },
  { type:'course', stage:1, order:5,  priority:'high', title:'الشباب والزواج', speaker:'الشيخ هاني حلمي', episodes:14, link:'https://t.me/elzwag/49', purpose:'قضايا الشباب المقبل على الزواج ودوافعه وتحدياته.' },
  { type:'course', stage:1, order:6,  priority:'high', title:'فقه الزواج', speaker:'د. سوزان الشافعي', episodes:27, link:'https://t.me/elzwag/590', purpose:'الأحكام الفقهية للخطبة والعقد والزواج.' },
  { type:'course', stage:1, order:7,  priority:'high', title:'خطّط لزواجك (منصة زادي)', speaker:'د. أسامة زيدان', episodes:29, link:'https://t.me/elzwag/755', purpose:'تخطيط عملي ممنهج لمشروع الزواج.' },
  { type:'course', stage:1, order:8,  priority:'high', title:'دورة للمقبلين على الزواج', speaker:'د. أسامة زيدان', episodes:6, link:'https://t.me/elzwag/498', purpose:'تأهيل مركّز للمقبلين على الزواج.' },
  { type:'course', stage:1, order:9,  priority:'high', title:'دورة شريك حياتي', speaker:'د. أسامة يحيى أبو سلامة', episodes:5, link:'https://t.me/elzwag/845', purpose:'معايير ومهارات اختيار الشريك والتعامل معه.' },
  { type:'course', stage:1, order:10, priority:'high', title:'برنامج تأهيل المقبلين على الزواج', speaker:'جمعية تآلف', episodes:5, link:'https://t.me/elzwag/821', purpose:'برنامج تأهيلي مؤسسي للمقبلين على الزواج.' },
  // الكتب المرافقة
  { type:'book', stage:1, order:101, priority:'medium', title:'أسئلة الخطوبة', link:'https://t.me/elzwag/153', purpose:'مرجعك الأهم في مرحلة الخطوبة لبناء بنك الأسئلة.' },
  { type:'book', stage:1, order:102, priority:'medium', title:'فن اختيار شريك الحياة', link:'https://t.me/elzwag/149', purpose:'معايير الاختيار العملية.' },
  { type:'book', stage:0, order:103, priority:'medium', title:'وقفات للشباب والفتيات قبل الخطبة', link:'https://t.me/elzwag/88', purpose:'وقفات تمهيدية قبل الإقدام.' },
  { type:'book', stage:1, order:104, priority:'medium', title:'فقه النساء في الخطبة والزواج', link:'https://t.me/elzwag/76', purpose:'الجانب الفقهي للخطبة.' },
  { type:'book', stage:1, order:105, priority:'medium', title:'اختيار الزوجين في الإسلام', link:'https://t.me/elzwag/127', purpose:'ضوابط الاختيار الشرعية.' },
  { type:'book', stage:1, order:106, priority:'medium', title:'أحكام الخطبة في الفقه الإسلامي', link:'https://t.me/elzwag/126', purpose:'تفصيل أحكام الخطبة.' },
  { type:'book', stage:1, order:107, priority:'medium', title:'كنت أود أن أعرف هذا قبل أن أتزوج', link:'https://t.me/elzwag/84', purpose:'خبرات لتفادي مفاجآت ما بعد الزواج.' },
  { type:'book', stage:2, order:108, priority:'medium', title:'شخصية المرأة المسلمة', link:'https://t.me/elzwag/105', purpose:'فهم شخصية الزوجة.' },
  { type:'book', stage:2, order:109, priority:'medium', title:'شخصية المسلم', link:'https://t.me/elzwag/106', purpose:'بناء شخصيتك أنت.' },
  { type:'book', stage:2, order:110, priority:'medium', title:'احتياجاته واحتياجاتها', link:'https://t.me/elzwag/144', purpose:'الفروق في الاحتياجات بين الزوجين.' },
  // المكتبة المرئية (يوتيوب) — تُشغَّل داخل السايت
  { type:'video',  stage:0, order:201, priority:'medium', title:'الزواج عبودية العمر', speaker:'الشيخ محمد خيري', link:'https://youtu.be/J2OZgA5lHeE', purpose:'ترسيخ المفهوم الروحي والعبادي للزواج.' },
  { type:'video',  stage:1, order:202, priority:'medium', title:'اختيار شريك الحياة (جزء 1)', speaker:'د. أحمد العربي', link:'https://youtu.be/SRsXB-EcvXk', purpose:'معايير وأسس الاختيار.' },
  { type:'video',  stage:1, order:203, priority:'medium', title:'اختيار شريك الحياة (جزء 2)', speaker:'د. أحمد العربي', link:'https://youtu.be/P6quAlK1a9I', purpose:'استكمال معايير الاختيار والتطبيق العملي.' },
  { type:'video',  stage:1, order:204, priority:'medium', title:'فن اختيار', speaker:'علاء حامد', link:'https://youtu.be/TuUEWKwwSH0', purpose:'منظور إضافي حول عملية الاختيار.' },
  { type:'video',  stage:1, order:205, priority:'later',  title:'ايه المشكلة في الزواج (حلقة 1)', link:'https://youtu.be/XqDe0Wgdt6M', purpose:'استعراض للمشكلات الشائعة في الزواج.' },
  { type:'video',  stage:1, order:206, priority:'later',  title:'ايه المشكلة في الزواج (حلقة 2)', link:null, purpose:'استكمال المشكلات وبداية الحلول. (الرابط الأصلي كان لفيديو آخر — بانتظار الرابط الصحيح.)' },
  { type:'video',  stage:2, order:207, priority:'medium', title:'المرأة الذكية ومفاتيح الرجل', speaker:'الشيخ أبو إسحاق الحويني', link:null, purpose:'فهم الفروقات النفسية والتعامل معها. (بانتظار رابط الحويني الصحيح — الرابط القديم كان لحلقة القوامة.)' },
  { type:'course', stage:3, order:208, priority:'medium', title:'سلسلة ألف باء زواج', speaker:'د. عبد الرحمن ذاكر', link:'https://youtu.be/gla27IuF5zM', purpose:'مقدمة شاملة لأساسيات الزواج.' },
  { type:'course', stage:4, order:209, priority:'medium', title:'سلسلة البيت المسلم', speaker:'م. أيمن', link:'https://youtube.com/playlist?list=PLnFJTGgdQYTOWcUXdFLzpsgy6_rlXkwrh', purpose:'سلسلة شاملة لبناء الأسرة المسلمة.' },
  { type:'course', stage:4, order:210, priority:'medium', title:'سلسلة بيوت منوّرة (الموسم الأول)', speaker:'هالة سمير', link:'https://youtube.com/playlist?list=PLk-FjFTRMdpjbLWJhOlHGiCRO8noVz20O', purpose:'دورة متكاملة لتنوير البيوت.' },
  { type:'course', stage:4, order:211, priority:'medium', title:'دورة وئام', link:'https://youtube.com/playlist?list=PL8HXRNE0xR_r3NMTlCkM1ttvadFM56vnh', purpose:'دورة تركّز على التوافق والوئام الزوجي.' },
  { type:'course', stage:4, order:212, priority:'medium', title:'الدورة التأهيلية', speaker:'د. أسامة زيدان', link:'https://youtube.com/playlist?list=PL1_wZ0MJhhg4lgNinwzQ5SA_bctoA1HxE', purpose:'دورة تأهيلية متعمّقة للعلاقة الزوجية.' },
  { type:'course', stage:4, order:213, priority:'medium', title:'سلسلة عاطف وعواطف', speaker:'د. محمد الغليظ', link:'https://youtube.com/playlist?list=PL6cNlIADmUhOHblEQeH5mwbNZ8rmctGpq', purpose:'الجوانب العاطفية في الزواج.' },
  { type:'video',  stage:5, order:214, priority:'later',  title:'سيرته لتصحيح مسارك', speaker:'الشيخ محمد خيري', link:'https://youtu.be/oLRKrPRzCWg', purpose:'توجيهات لتصحيح مسار الحياة الزوجية.' },
  { type:'video',  stage:5, order:215, priority:'later',  title:'حتى ترضى', speaker:'الشيخ محمد خيري', link:'https://youtu.be/DHVhe0yWQ6E', purpose:'مفاهيم الرضا والقناعة في العلاقة.' },
  { type:'video',  stage:5, order:216, priority:'later',  title:'قواعد حياتية للأسرة الرضية', speaker:'الشيخ محمد خيري', link:'https://youtu.be/qkNix3ol8Jo', purpose:'قواعد عملية لحياة أسرية سعيدة.' },
  { type:'video',  stage:5, order:217, priority:'later',  title:'الحياء المفتقد', speaker:'أحمد العربي', link:'https://youtu.be/PBGXnDYnkTI', purpose:'أهمية الحياء في العلاقة الزوجية.' },
  { type:'video',  stage:3, order:218, priority:'medium', title:'كيف نبني زواجًا مستقرًا', speaker:'د. جاسم المطوع (بودكاست بدون ورق)', link:'https://www.youtube.com/watch?v=_57DQt0CP48', purpose:'استراتيجيات عملية لبناء الاستقرار في العلاقة.' },
  { type:'video',  stage:3, order:219, priority:'medium', title:'مفهوم القوامة', speaker:'د. الحارث المزيدي (بودكاست مسار)', link:'https://www.youtube.com/watch?v=GYi_DS_5yHs', purpose:'القوامة كخدمة ومسؤولية لا تسلّط، وتقاطعها مع تحديات العصر.' },
];
export async function seedCurriculum(s) {
  const existing = await C('resources').where('pairId', '==', s.pairId).where('seed', '==', true).get();
  const have = new Set();
  existing.docs.forEach((d) => { const x = d.data(); [x.seedKey, x.link, x.title].forEach((v) => { if (v) have.add(v); }); });
  const now = Date.now(); let n = 0;
  for (const it of CURRICULUM) {
    const key = it.link || it.title;
    if (have.has(key) || have.has(it.title)) continue;       // top-up only: skip what's already there
    const vid = ytId(it.link);
    const id = uid();
    await C('resources').doc(id).set({
      pairId: s.pairId, title: it.title, type: it.type, stage: it.stage, priority: it.priority || 'medium',
      speaker: it.speaker || null, episodes: it.episodes || null, purpose: it.purpose || null,
      link: it.link || null, thumbnail: vid ? 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg' : null,
      sourceText: null, status: 'not_started', seed: true, seedKey: key,
      createdBy: s.userId, createdAt: now + (it.order || n),
    });
    const c = CONTENT[it.title];
    if (c) {
      const parts = [c.summary];
      if (c.insights && c.insights.length) parts.push('\n— أهم الأفكار —\n' + c.insights.map((x) => '• ' + x).join('\n'));
      if (c.applications && c.applications.length) parts.push('\n— تطبيقات عملية —\n' + c.applications.map((x) => '• ' + x).join('\n'));
      await C('summaries').doc(id).set({ pairId: s.pairId, resourceId: id, content: parts.join('\n'), generatedBy: 'curated' });
      let qi = 0;
      for (const qt of (c.questions || [])) {
        const qid = uid();
        const ord = now + (it.order || 0) * 100 + qi;
        await C('questions').doc(qid).set({ pairId: s.pairId, resourceId: id, text: qt, state: 'open', responseCount: 0, order: ord, createdAt: ord });
        qi++;
      }
    }
    have.add(key); have.add(it.title); n++;
  }
  if (n) await record(s.pairId, 'journey', 'seed', 'curriculum_seeded', { actor: s.userId, meta: { count: n } });
  return { seeded: n, already: n === 0, total: existing.docs.length + n };
}

// ============================================================
// فيز 4 — الملاحظات + العروض العامة + مراجعة القرار
// ============================================================
// ---- notes (مشتركة + خاصة) على المورد ----
export async function getNotes(s, resourceId) {
  await resourceInPair(s, resourceId);
  const sh = await C('notes').doc(resourceId + '_shared').get();
  const mine = await C('notes').doc(resourceId + '_' + s.userId).get();
  return { shared: sh.exists ? (sh.data().content || '') : '', mine: mine.exists ? (mine.data().content || '') : '' };
}
export async function saveNote(s, resourceId, scope, content) {
  await resourceInPair(s, resourceId);
  const shared = scope === 'shared';
  const docId = shared ? resourceId + '_shared' : resourceId + '_' + s.userId;
  await C('notes').doc(docId).set({ pairId: s.pairId, resourceId, scope: shared ? 'shared' : 'private', userId: shared ? null : s.userId, content: (content || '').slice(0, 5000), updatedAt: Date.now() });
  return { ok: true };
}

// ---- عرض عام لكل المناقشات (الأسئلة عبر كل الموارد) ----
export async function listAllQuestions(s) {
  const snap = await C('questions').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
}

// ---- مراجعة قرار ----
export async function markDecisionReviewed(s, decisionId) {
  const ref = C('decisions').doc(decisionId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  await ref.update({ reviewed: true, reviewedAt: Date.now() });
  await record(s.pairId, 'decision', decisionId, 'reviewed', { actor: s.userId });
  return { id: decisionId, ...(await ref.get()).data() };
}

// ============================================================
// فيز 5 — التواصل العاطفي (خفيف، داخل الرؤية، بلا تتبّع/AI)
// ============================================================
// ---- قائمة أمنياتنا ----
export async function listWishes(s) {
  const snap = await C('wishes').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
}
export async function createWish(s, b) {
  const id = uid();
  await C('wishes').doc(id).set({ pairId: s.pairId, text: (b.text || '').slice(0, 300), done: false, createdBy: s.userId, createdAt: Date.now() });
  return { id, ...(await C('wishes').doc(id).get()).data() };
}
export async function toggleWish(s, id) { const ref = await ownedDoc('wishes', id, s); await ref.update({ done: !(await ref.get()).data().done }); return { id, ...(await ref.get()).data() }; }
export async function deleteWish(s, id) { const ref = await ownedDoc('wishes', id, s); await ref.delete(); return { ok: true }; }

// ---- مساحة الامتنان (منسوبة لصاحبها) ----
export async function listGratitude(s) {
  const snap = await C('gratitude').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, text: x.text, mine: x.userId === s.userId, createdAt: x.createdAt }; }).sort((a, b) => b.createdAt - a.createdAt);
}
export async function addGratitude(s, b) { const id = uid(); await C('gratitude').doc(id).set({ pairId: s.pairId, userId: s.userId, text: (b.text || '').slice(0, 500), createdAt: Date.now() }); return { ok: true }; }
export async function deleteGratitude(s, id) {
  const ref = C('gratitude').doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  if (snap.data().userId !== s.userId) throw new Err(403, 'FORBIDDEN');
  await ref.delete(); return { ok: true };
}

// ---- رسالة للمستقبل (مختومة حتى تاريخ الفتح) ----
export async function listCapsules(s) {
  const now = Date.now();
  const snap = await C('capsules').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => {
    const x = d.data(); const mine = x.userId === s.userId; const opened = !x.openAt || now >= x.openAt; const visible = mine || opened;
    return { id: d.id, mine, openDate: x.openDate || null, sealed: !visible, content: visible ? x.content : null, createdAt: x.createdAt };
  }).sort((a, b) => b.createdAt - a.createdAt);
}
export async function createCapsule(s, b) {
  const id = uid(); const parsed = b.openDate ? Date.parse(b.openDate) : NaN;
  await C('capsules').doc(id).set({ pairId: s.pairId, userId: s.userId, content: (b.content || '').slice(0, 3000), openDate: b.openDate || null, openAt: isNaN(parsed) ? null : parsed, createdAt: Date.now() });
  return { ok: true };
}

// ---- فحص حالتنا (لحظي فقط، بلا سجلّ) ----
export async function getMood(s) {
  const snap = await C('mood').where('pairId', '==', s.pairId).get();
  let mine = null, partner = null;
  snap.docs.forEach((d) => { const x = d.data(); if (x.userId === s.userId) mine = x.value; else partner = x.value; });
  return { mine, partner };
}
export async function setMood(s, value) { await C('mood').doc(s.pairId + '_' + s.userId).set({ pairId: s.pairId, userId: s.userId, value: (value || '').slice(0, 20), updatedAt: Date.now() }); return { ok: true }; }

// ---- صندوق التفاهم (إثارة موضوع بلطف، يُتابَع لنتيجة) ----
export async function listSafe(s) {
  const snap = await C('safespace').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, topic: x.topic, feeling: x.feeling, need: x.need, status: x.status, mine: x.userId === s.userId, createdAt: x.createdAt }; }).sort((a, b) => b.createdAt - a.createdAt);
}
export async function createSafe(s, b) { const id = uid(); await C('safespace').doc(id).set({ pairId: s.pairId, userId: s.userId, topic: (b.topic || '').slice(0, 200), feeling: (b.feeling || '').slice(0, 500), need: (b.need || '').slice(0, 500), status: 'open', createdAt: Date.now() }); return { ok: true }; }
export async function markSafeAddressed(s, id) { const ref = await ownedDoc('safespace', id, s); await ref.update({ status: 'addressed' }); return { id, ...(await ref.get()).data() }; }

// ============================================================
// ميثاقنا — Charter (covenant items): tagaful / conflict / niyyah / calmword
// ============================================================
const CHARTER_KINDS = ['tagaful', 'conflict', 'niyyah', 'calmword'];
export async function listCharter(s) {
  const snap = await C('charter').where('pairId', '==', s.pairId).get();
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, kind: x.kind, text: x.text, mine: x.createdBy === s.userId, createdAt: x.createdAt }; })
    .sort((a, b) => a.createdAt - b.createdAt);
}
export async function addCharterItem(s, b) {
  const kind = (b && b.kind) || '';
  if (!CHARTER_KINDS.includes(kind)) throw new Err(400, 'BAD_KIND');
  const text = ((b && b.text) || '').trim().slice(0, 300);
  if (!text) throw new Err(400, 'EMPTY');
  if (kind === 'calmword') { // singular: only one calm word
    const ex = await C('charter').where('pairId', '==', s.pairId).where('kind', '==', 'calmword').get();
    for (const d of ex.docs) await C('charter').doc(d.id).delete();
  }
  const id = uid();
  await C('charter').doc(id).set({ pairId: s.pairId, kind, text, createdBy: s.userId, createdAt: Date.now() });
  await record(s.pairId, 'charter', id, 'charter_add', { actor: s.userId, meta: { kind } });
  return { ok: true, id };
}
export async function deleteCharterItem(s, id) {
  const ref = C('charter').doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data().pairId !== s.pairId) throw new Err(404, 'NOT_FOUND');
  await ref.delete(); return { ok: true };
}

// ============================================================
// كتالوج المفاتيح — Keys (per-user, both-visible): soothe / annoy
// ============================================================
export async function listKeys(s) {
  const snap = await C('keys').where('pairId', '==', s.pairId).get();
  const mine = [], partner = [];
  snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt)
    .forEach((x) => { (x.userId === s.userId ? mine : partner).push({ id: x.id, kind: x.kind, text: x.text }); });
  return { mine, partner };
}
export async function addKey(s, b) {
  const kind = (b && b.kind) || '';
  if (!['soothe', 'annoy'].includes(kind)) throw new Err(400, 'BAD_KIND');
  const text = ((b && b.text) || '').trim().slice(0, 200);
  if (!text) throw new Err(400, 'EMPTY');
  const id = uid();
  await C('keys').doc(id).set({ pairId: s.pairId, userId: s.userId, kind, text, createdAt: Date.now() });
  return { ok: true, id };
}
export async function deleteKey(s, id) {
  const ref = C('keys').doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data().pairId !== s.pairId || snap.data().userId !== s.userId) throw new Err(404, 'NOT_FOUND');
  await ref.delete(); return { ok: true };
}

// ============================================================
// مادة الأسبوع — Focus (one shared current resource)
// ============================================================
export async function getFocus(s) {
  const snap = await C('focus').doc(s.pairId).get();
  const rid = snap.exists ? snap.data().resourceId : null;
  if (!rid) return { focus: null };
  const rSnap = await C('resources').doc(rid).get();
  if (!rSnap.exists || rSnap.data().pairId !== s.pairId) return { focus: null };
  const pm = await progressMap(s); const pid = await partnerId(s);
  return { focus: { id: rid, ...rSnap.data(), prog: attachProg(pm, pid, s, rid) } };
}
export async function setFocus(s, resourceId) {
  await resourceInPair(s, resourceId);
  await C('focus').doc(s.pairId).set({ pairId: s.pairId, resourceId, setBy: s.userId, setAt: Date.now() });
  return { ok: true };
}
export async function clearFocus(s) {
  await C('focus').doc(s.pairId).set({ pairId: s.pairId, resourceId: null, setAt: Date.now() });
  return { ok: true };
}

// إضافة مورد بمحتوى NotebookLM كامل (ملخص + أفكار + أسئلة + تطبيقات) دفعة واحدة
function _lines(v){
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || '').split(/\r?\n/).map((x) => x.replace(/^[\s•\-*\u2022\d.)]+/, '').trim()).filter(Boolean);
}
export async function createResourceWithContent(s, b) {
  const r = await createResource(s, b);
  const id = r.id;
  const summary = String(b.summary || '').trim();
  const insights = _lines(b.insights);
  const applications = _lines(b.applications);
  const questions = _lines(b.questions);
  if (summary || insights.length || applications.length) {
    const parts = [];
    if (summary) parts.push(summary);
    if (insights.length) parts.push('\n— أهم الأفكار —\n' + insights.map((x) => '• ' + x).join('\n'));
    if (applications.length) parts.push('\n— تطبيقات عملية —\n' + applications.map((x) => '• ' + x).join('\n'));
    await C('summaries').doc(id).set({ pairId: s.pairId, resourceId: id, content: parts.join('\n'), generatedBy: 'notebooklm' });
  }
  let ord = Date.now();
  for (const qt of questions) { const qid = uid(); await C('questions').doc(qid).set({ pairId: s.pairId, resourceId: id, text: qt, state: 'open', responseCount: 0, order: ord, createdAt: ord }); ord++; }
  return r;
}
