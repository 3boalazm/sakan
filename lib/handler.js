import * as S from './services.js';
import { ensureDb, envPresent } from './firebase.js';

// startup / cold-start log (their step 3, in our style)
console.log(JSON.stringify({ event: 'cold_start', firebaseEnvPresent: envPresent() }));

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// host-agnostic: takes a plain request shape, returns { status, body }
export async function handle({ method, path, body = {}, token = null }) {
  try {
    // static / health — no auth, no DB (this is the "separate static from auth" idea)
    if (method === 'GET' && path.length === 1 && path[0] === 'favicon.ico') return { status: 204, body: null };
    // TWA Digital Asset Links
    if (method === 'GET' && path.length === 0 && (body._raw_path || '').startsWith('/.well-known/assetlinks')) {
      return { status: 200, body: [{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"app.sakan.twa","sha256_cert_fingerprints":["REPLACE_WITH_YOUR_SHA256_FINGERPRINT"]}}] };
    }
    if (method === 'GET' && path.length === 0) return { status: 200, body: { ok: true, service: 'sakan', firebaseEnvPresent: envPresent() } };

    await ensureDb(); // lazy init; throws a CLEAN error if env missing/bad
    const data = await route(method, path, body, token);
    return { status: 200, body: data ?? null };
  } catch (e) {
    if (e?.status) return { status: e.status, body: { error: { code: e.code } } };
    const msg = String(e?.message || '');
    if (/invalid .* transition/.test(msg)) return { status: 409, body: { error: { code: 'INVALID_TRANSITION' } } };
    console.error('ERR', msg);
    return { status: 500, body: { error: { code: 'ERROR', message: msg } } };
  }
}

async function route(m, p, body, token) {
  if (m === 'POST' && eq(p, ['pair'])) return S.createPair(body);
  if (m === 'POST' && eq(p, ['pair', 'join'])) return S.joinPair(body);
  if (m === 'POST' && eq(p, ['login'])) return S.login(body);

  const s = await S.resolve(token); // pair_id derived from token only

  if (m === 'GET' && eq(p, ['resources'])) return S.listResources(s);
  if (m === 'POST' && eq(p, ['resources'])) return S.createResource(s, body);
  if (m === 'POST' && eq(p, ['resources', 'full'])) return S.createResourceWithContent(s, body);
  if (m === 'GET' && p.length === 2 && p[0] === 'resources') return S.getResource(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'resources' && p[2] === 'summary') return S.generateSummary(s, p[1]);
  if (m === 'POST' && p.length === 4 && p[0] === 'resources' && p[2] === 'questions' && p[3] === 'generate') return S.generateQuestionsFor(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'resources' && p[2] === 'questions') return S.addQuestion(s, p[1], body.text);
  if (m === 'GET' && p.length === 3 && p[0] === 'resources' && p[2] === 'events') return S.resourceEvents(s, p[1]);

  if (m === 'GET' && p.length === 3 && p[0] === 'questions' && p[2] === 'responses') return S.getResponses(s, p[1]);
  if (m === 'PUT' && p.length === 3 && p[0] === 'questions' && p[2] === 'responses') return S.submitResponse(s, p[1], body.text);
  if (m === 'POST' && p.length === 3 && p[0] === 'questions' && p[2] === 'reveal') return S.reveal(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'questions' && p[2] === 'force-reveal') return S.forceReveal(s, p[1]);
  if (m === 'GET' && p.length === 3 && p[0] === 'questions' && p[2] === 'events') return S.questionEvents(s, p[1]);

  if (m === 'GET' && eq(p, ['decisions'])) return S.listDecisions(s);
  if (m === 'POST' && eq(p, ['decisions'])) return S.createDecision(s, body);
  if (m === 'GET' && p.length === 2 && p[0] === 'decisions') return S.getDecision(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'decisions' && p[2] === 'confirm') return S.confirmDecision(s, p[1]);

  // ---- phase 2: tasks ----
  if (m === 'GET' && eq(p, ['tasks'])) return S.listTasks(s);
  if (m === 'POST' && eq(p, ['tasks'])) return S.createTask(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'tasks' && p[2] === 'toggle') return S.toggleTask(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'tasks' && p[2] === 'delete') return S.deleteTask(s, p[1]);

  // ---- phase 2: budget ----
  if (m === 'GET' && eq(p, ['budget'])) return S.listBudget(s);
  if (m === 'POST' && eq(p, ['budget'])) return S.createBudgetItem(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'budget' && p[2] === 'pay') return S.payBudgetItem(s, p[1], body.amount);
  if (m === 'POST' && p.length === 3 && p[0] === 'budget' && p[2] === 'delete') return S.deleteBudgetItem(s, p[1]);

  // ---- phase 2: shopping ----
  if (m === 'GET' && eq(p, ['shopping'])) return S.listShopping(s);
  if (m === 'POST' && eq(p, ['shopping'])) return S.createShoppingItem(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'shopping' && p[2] === 'toggle') return S.toggleShoppingItem(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'shopping' && p[2] === 'delete') return S.deleteShoppingItem(s, p[1]);

  // ---- phase 3: journey / curriculum ----
  if (m === 'POST' && eq(p, ['journey', 'seed'])) return S.seedCurriculum(s);

  // ---- phase 4: notes / global views / review ----
  if (m === 'GET' && p.length === 3 && p[0] === 'resources' && p[2] === 'notes') return S.getNotes(s, p[1]);
  if (m === 'PUT' && p.length === 3 && p[0] === 'resources' && p[2] === 'notes') return S.saveNote(s, p[1], body.scope, body.content);
  if (m === 'PUT' && p.length === 3 && p[0] === 'resources' && p[2] === 'progress') return S.setProgress(s, p[1], body.status);
  if (m === 'PUT' && p.length === 3 && p[0] === 'resources' && p[2] === 'priority') return S.setPriority(s, p[1], body.priority);
  if (m === 'PUT' && p.length === 3 && p[0] === 'resources' && p[2] === 'category') return S.setCategory(s, p[1], body.category);
  if (m === 'GET' && eq(p, ['questions'])) return S.listAllQuestions(s);
  if (m === 'POST' && p.length === 3 && p[0] === 'decisions' && p[2] === 'reviewed') return S.markDecisionReviewed(s, p[1]);

  // ---- phase 5: connection ----
  if (m === 'GET' && eq(p, ['wishes'])) return S.listWishes(s);
  if (m === 'POST' && eq(p, ['wishes'])) return S.createWish(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'wishes' && p[2] === 'toggle') return S.toggleWish(s, p[1]);
  if (m === 'POST' && p.length === 3 && p[0] === 'wishes' && p[2] === 'delete') return S.deleteWish(s, p[1]);
  if (m === 'GET' && eq(p, ['gratitude'])) return S.listGratitude(s);
  if (m === 'POST' && eq(p, ['gratitude'])) return S.addGratitude(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'gratitude' && p[2] === 'delete') return S.deleteGratitude(s, p[1]);
  if (m === 'GET' && eq(p, ['capsules'])) return S.listCapsules(s);
  if (m === 'POST' && eq(p, ['capsules'])) return S.createCapsule(s, body);
  if (m === 'GET' && eq(p, ['mood'])) return S.getMood(s);
  if (m === 'PUT' && eq(p, ['mood'])) return S.setMood(s, body.value);
  if (m === 'GET' && eq(p, ['safespace'])) return S.listSafe(s);
  if (m === 'POST' && eq(p, ['safespace'])) return S.createSafe(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'safespace' && p[2] === 'addressed') return S.markSafeAddressed(s, p[1]);

  // ---- special (charter / keys / focus) ----
  if (m === 'GET' && eq(p, ['charter'])) return S.listCharter(s);
  if (m === 'POST' && eq(p, ['charter'])) return S.addCharterItem(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'charter' && p[2] === 'delete') return S.deleteCharterItem(s, p[1]);
  if (m === 'GET' && eq(p, ['keys'])) return S.listKeys(s);
  if (m === 'POST' && eq(p, ['keys'])) return S.addKey(s, body);
  if (m === 'POST' && p.length === 3 && p[0] === 'keys' && p[2] === 'delete') return S.deleteKey(s, p[1]);
  if (m === 'GET' && eq(p, ['focus'])) return S.getFocus(s);
  if (m === 'PUT' && eq(p, ['focus'])) return S.setFocus(s, body.resourceId);
  if (m === 'POST' && eq(p, ['focus', 'clear'])) return S.clearFocus(s);

  if (m === 'GET' && eq(p, ['journey'])) return S.listMyJourney(s);

  const e = new Error('NOT_FOUND'); e.status = 404; e.code = 'NOT_FOUND'; throw e;
}
