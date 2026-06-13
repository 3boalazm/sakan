import http from 'node:http';
import * as S from './services.js';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body ?? null));
};
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const tokenOf = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;

// route table: [method, regex, handler(ctx)] ; ctx = {params, body, session?}
const R = [];
const add = (m, p, h, open = false) => R.push({ m, re: new RegExp('^' + p + '$'), h, open });

add('POST', '/pair', (c) => S.createPair(c.body), true);
add('POST', '/pair/join', (c) => S.joinPair(c.body), true);

add('GET', '/resources', (c) => S.listResources(c.session));
add('POST', '/resources', (c) => S.createResource(c.session, c.body));
add('GET', '/resources/([^/]+)', (c) => S.getResource(c.session, c.params[0]));
add('POST', '/resources/([^/]+)/summary', (c) => S.generateSummary(c.session, c.params[0]));
add('POST', '/resources/([^/]+)/questions/generate', (c) => S.generateQuestionsFor(c.session, c.params[0]));
add('POST', '/resources/([^/]+)/questions', (c) => S.addQuestion(c.session, c.params[0], c.body.text));

add('GET', '/questions/([^/]+)/responses', (c) => S.getResponses(c.session, c.params[0]));
add('GET', '/questions/([^/]+)/events', (c) => S.questionEvents(c.session, c.params[0]));
add('PUT', '/questions/([^/]+)/responses', (c) => S.submitResponse(c.session, c.params[0], c.body.text));
add('POST', '/questions/([^/]+)/reveal', (c) => S.reveal(c.session, c.params[0]));
add('POST', '/questions/([^/]+)/force-reveal', (c) => S.forceReveal(c.session, c.params[0]));

add('GET', '/resources/([^/]+)/events', (c) => S.resourceEvents(c.session, c.params[0]));

add('GET', '/decisions', (c) => S.listDecisions(c.session));
add('GET', '/decisions/([^/]+)', (c) => S.getDecision(c.session, c.params[0]));
add('POST', '/decisions', (c) => S.createDecision(c.session, c.body));
add('POST', '/decisions/([^/]+)/confirm', (c) => S.confirmDecision(c.session, c.params[0]));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = R.find((r) => r.m === req.method && r.re.test(url.pathname));
  if (!route) return json(res, 404, { error: { code: 'NOT_FOUND' } });
  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    const params = url.pathname.match(route.re).slice(1);
    const session = route.open ? null : S.resolve(tokenOf(req)); // pair_id derived from token only
    const out = await route.h({ params, body, session });
    json(res, 200, out);
  } catch (e) {
    const msg = String(e?.message || '');
    if (e?.status) return json(res, e.status, { error: { code: e.code } });
    if (/invalid .* transition/.test(msg)) return json(res, 409, { error: { code: 'INVALID_TRANSITION' } });
    json(res, 500, { error: { code: 'ERROR', message: msg } });
  }
});

export function start(port = 0) {
  return new Promise((resolve) => server.listen(port, '0.0.0.0', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start(Number(process.env.PORT) || 8787).then((s) => console.log('Sakan API on http://127.0.0.1:' + s.address().port));
}
