import http from 'node:http';
import { handle } from './lib/handler.js';
import { envPresent } from './lib/firebase.js';

console.log('SERVER STARTED');
console.log('ENV CHECK FIREBASE_SERVICE_ACCOUNT:', envPresent());

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); } // CORS preflight
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '').split('/').filter(Boolean);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
  const { status, body: out } = await handle({ method: req.method, path, body, token });
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(out ?? null));
});

const port = Number(process.env.PORT) || 8787;
server.listen(port, '0.0.0.0', () => console.log('Sakan API on :' + port));
