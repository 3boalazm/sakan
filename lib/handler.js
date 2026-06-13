import * as S from './services.js';

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// host-agnostic: takes a plain request shape, returns { status, body }
export async function handle({ method, path, body = {}, token = null }) {
  try {
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

  const s = await S.resolve(token); // pair_id derived from token only

  if (m === 'GET' && eq(p, ['resources'])) return S.listResources(s);
  if (m === 'POST' && eq(p, ['resources'])) return S.createResource(s, body);
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

  const e = new Error('NOT_FOUND'); e.status = 404; e.code = 'NOT_FOUND'; throw e;
}
