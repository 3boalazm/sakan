import { NextResponse } from 'next/server';
import * as S from '@/lib/services';
import { ensureDb } from '@/lib/firebase';

// ── helpers ──────────────────────────────────────────────────────────────
const json = (data, status = 200) => NextResponse.json(data, { status });
const err  = (e) => {
  if (e?.status) return json({ error: { code: e.code } }, e.status);
  const msg = String(e?.message || '');
  if (/invalid .* transition/.test(msg)) return json({ error: { code: 'INVALID_TRANSITION' } }, 409);
  console.error('ERR', msg);
  return json({ error: { code: 'ERROR', message: msg } }, 500);
};

function getToken(req) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
}

function getPath(params) {
  return [].concat(params?.path || []);
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ── route handler (shared GET/POST/PUT) ──────────────────────────────────
async function handle(req, { params }) {
  const method = req.method;
  const p      = getPath(params);
  let body = {};
  try { body = await req.json(); } catch {}

  try {
    // health
    if (method === 'GET' && p.length === 0) return json({ ok: true, service: 'sakan' });

    await ensureDb();
    const token = getToken(req);

    // ── auth (no session needed) ──
    if (method === 'POST' && eq(p, ['pair']))      return json(await S.createPair(body));
    if (method === 'POST' && eq(p, ['pair','join']))return json(await S.joinPair(body));
    if (method === 'POST' && eq(p, ['login']))      return json(await S.login(body));

    // ── authenticated ──
    const s = await S.resolve(token);

    // resources
    if (method === 'GET'  && eq(p, ['resources']))                                       return json(await S.listResources(s));
    if (method === 'POST' && eq(p, ['resources']))                                       return json(await S.createResource(s, body));
    if (method === 'POST' && eq(p, ['resources','full']))                                return json(await S.createResourceWithContent(s, body));
    if (method === 'GET'  && p.length===2 && p[0]==='resources')                        return json((await S.getResource(s, p[1])));
    if (method === 'POST' && p.length===3 && p[0]==='resources' && p[2]==='summary')    return json(await S.generateSummary(s, p[1]));
    if (method === 'POST' && p.length===4 && p[0]==='resources' && p[2]==='questions' && p[3]==='generate') return json(await S.generateQuestionsFor(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='resources' && p[2]==='questions') return json(await S.addQuestion(s, p[1], body.text));
    if (method === 'GET'  && p.length===3 && p[0]==='resources' && p[2]==='events')    return json(await S.resourceEvents(s, p[1]));
    if (method === 'GET'  && p.length===3 && p[0]==='resources' && p[2]==='notes')     return json(await S.getNotes(s, p[1]));
    if (method === 'PUT'  && p.length===3 && p[0]==='resources' && p[2]==='notes')     return json(await S.saveNote(s, p[1], body.scope, body.content));
    if (method === 'PUT'  && p.length===3 && p[0]==='resources' && p[2]==='progress')  return json(await S.setProgress(s, p[1], body.status));
    if (method === 'PUT'  && p.length===3 && p[0]==='resources' && p[2]==='priority')  return json(await S.setPriority(s, p[1], body.priority));
    if (method === 'PUT'  && p.length===3 && p[0]==='resources' && p[2]==='category')  return json(await S.setCategory(s, p[1], body.category));

    // questions
    if (method === 'GET'  && eq(p, ['questions']))                                       return json(await S.listAllQuestions(s));
    if (method === 'GET'  && p.length===3 && p[0]==='questions' && p[2]==='responses')  return json(await S.getResponses(s, p[1]));
    if (method === 'PUT'  && p.length===3 && p[0]==='questions' && p[2]==='responses')  return json(await S.submitResponse(s, p[1], body.text));
    if (method === 'POST' && p.length===3 && p[0]==='questions' && p[2]==='reveal')     return json(await S.reveal(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='questions' && p[2]==='force-reveal') return json(await S.forceReveal(s, p[1]));
    if (method === 'GET'  && p.length===3 && p[0]==='questions' && p[2]==='events')    return json(await S.questionEvents(s, p[1]));

    // decisions
    if (method === 'GET'  && eq(p, ['decisions']))                                       return json(await S.listDecisions(s));
    if (method === 'POST' && eq(p, ['decisions']))                                       return json(await S.createDecision(s, body));
    if (method === 'GET'  && p.length===2 && p[0]==='decisions')                        return json(await S.getDecision(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='decisions' && p[2]==='confirm')   return json(await S.confirmDecision(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='decisions' && p[2]==='reviewed')  return json(await S.markDecisionReviewed(s, p[1]));

    // tasks / budget / shopping
    if (method === 'GET'  && eq(p, ['tasks']))    return json(await S.listTasks(s));
    if (method === 'POST' && eq(p, ['tasks']))    return json(await S.createTask(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='tasks' && p[2]==='toggle') return json(await S.toggleTask(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='tasks' && p[2]==='delete') return json(await S.deleteTask(s, p[1]));
    if (method === 'GET'  && eq(p, ['budget']))   return json(await S.listBudget(s));
    if (method === 'POST' && eq(p, ['budget']))   return json(await S.createBudgetItem(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='budget' && p[2]==='pay')    return json(await S.payBudgetItem(s, p[1], body.amount));
    if (method === 'POST' && p.length===3 && p[0]==='budget' && p[2]==='delete') return json(await S.deleteBudgetItem(s, p[1]));
    if (method === 'GET'  && eq(p, ['shopping'])) return json(await S.listShopping(s));
    if (method === 'POST' && eq(p, ['shopping'])) return json(await S.createShoppingItem(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='shopping' && p[2]==='toggle') return json(await S.toggleShoppingItem(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='shopping' && p[2]==='delete') return json(await S.deleteShoppingItem(s, p[1]));

    // journey / curriculum
    if (method === 'GET'  && eq(p, ['journey']))       return json(await S.listMyJourney(s));
    if (method === 'POST' && eq(p, ['journey','seed'])) return json(await S.seedCurriculum(s));

    // connection (wishes / gratitude / capsules / mood / safespace)
    if (method === 'GET'  && eq(p, ['wishes']))   return json(await S.listWishes(s));
    if (method === 'POST' && eq(p, ['wishes']))   return json(await S.createWish(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='wishes' && p[2]==='toggle') return json(await S.toggleWish(s, p[1]));
    if (method === 'POST' && p.length===3 && p[0]==='wishes' && p[2]==='delete') return json(await S.deleteWish(s, p[1]));
    if (method === 'GET'  && eq(p, ['gratitude']))  return json(await S.listGratitude(s));
    if (method === 'POST' && eq(p, ['gratitude']))  return json(await S.addGratitude(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='gratitude' && p[2]==='delete') return json(await S.deleteGratitude(s, p[1]));
    if (method === 'GET'  && eq(p, ['capsules']))   return json(await S.listCapsules(s));
    if (method === 'POST' && eq(p, ['capsules']))   return json(await S.createCapsule(s, body));
    if (method === 'GET'  && eq(p, ['mood']))        return json(await S.getMood(s));
    if (method === 'PUT'  && eq(p, ['mood']))        return json(await S.setMood(s, body.value));
    if (method === 'GET'  && eq(p, ['safespace']))   return json(await S.listSafe(s));
    if (method === 'POST' && eq(p, ['safespace']))   return json(await S.createSafe(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='safespace' && p[2]==='addressed') return json(await S.markSafeAddressed(s, p[1]));

    // charter / keys / focus
    if (method === 'GET'  && eq(p, ['charter']))   return json(await S.listCharter(s));
    if (method === 'POST' && eq(p, ['charter']))   return json(await S.addCharterItem(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='charter' && p[2]==='delete') return json(await S.deleteCharterItem(s, p[1]));
    if (method === 'GET'  && eq(p, ['keys']))       return json(await S.listKeys(s));
    if (method === 'POST' && eq(p, ['keys']))       return json(await S.addKey(s, body));
    if (method === 'POST' && p.length===3 && p[0]==='keys' && p[2]==='delete') return json(await S.deleteKey(s, p[1]));
    if (method === 'GET'  && eq(p, ['focus']))      return json(await S.getFocus(s));
    if (method === 'PUT'  && eq(p, ['focus']))      return json(await S.setFocus(s, body.resourceId));
    if (method === 'POST' && eq(p, ['focus','clear'])) return json(await S.clearFocus(s));

    return json({ error: { code: 'NOT_FOUND' } }, 404);
  } catch (e) { return err(e); }
}

export const GET    = handle;
export const POST   = handle;
export const PUT    = handle;
export const DELETE = handle;
