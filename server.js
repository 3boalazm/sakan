import http from 'node:http';
import { handle } from './lib/handler.js';
import { envPresent } from './lib/firebase.js';
import { PAGE } from './lib/page.js';

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
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, 'http://x');

  // serve the Arabic app for any non-API GET request (so the domain shows the UI, not JSON)
  if (req.method === 'GET' && !url.pathname.startsWith('/api')) {
    if (url.pathname === '/favicon.ico') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname.startsWith('/fonts/')) {
      const name = url.pathname.slice('/fonts/'.length);
      try {
        const { FONTS } = await import('./lib/fonts.js');   // lazy: only loaded on first font request
        const b64 = FONTS[name];
        if (b64) {
          res.writeHead(200, { 'content-type': 'font/otf', 'cache-control': 'public, max-age=31536000, immutable', ...CORS });
          return res.end(Buffer.from(b64, 'base64'));
        }
      } catch {}
      res.writeHead(404, CORS); return res.end();
    }
    if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/js/')
        || url.pathname.startsWith('/icons/') || url.pathname === '/sw.js'
        || url.pathname === '/manifest.json') {
      try {
        const rel = decodeURIComponent(url.pathname).replace(/\.\.+/g, '');
        const fs = await import('node:fs/promises');
        const pathMod = await import('node:path');
        // media/ lives at repo root; js/, icons/, sw.js, manifest.json live under src/
        const isMedia = url.pathname.startsWith('/media/');
        const rootFile = pathMod.join(process.cwd(), rel);
        const srcFile  = pathMod.join(process.cwd(), 'src', rel);
        let file, data;
        if (isMedia) {
          // try repo root first, then src/media/
          try { data = await fs.readFile(rootFile); file = rootFile; }
          catch { data = await fs.readFile(srcFile); file = srcFile; }
        } else {
          file = srcFile;
          data = await fs.readFile(file);
        }
        const ext = file.split('.').pop().toLowerCase();
        const ctMap = {
          js: 'application/javascript; charset=utf-8',
          json: 'application/json; charset=utf-8',
          svg: 'image/svg+xml',
          png: 'image/png',
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          otf: 'font/otf', ttf: 'font/ttf',
        };
        const ct = ctMap[ext] || 'application/octet-stream';
        const cc = (ext === 'js' || ext === 'css') ? 'public, max-age=3600'
                 : (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'otf') ? 'public, max-age=86400'
                 : 'no-cache';
        res.writeHead(200, { 'content-type': ct, 'cache-control': cc, ...CORS });
        return res.end(data);
      } catch { res.writeHead(404, CORS); return res.end(); }
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...CORS });
    return res.end(PAGE);
  }

  // API (health is at /api ; pair/resources/... under /api/*)
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '').split('/').filter(Boolean);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
  const { status, body: out } = await handle({ method: req.method, path, body, token });
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(out ?? null));
});

const port = Number(process.env.PORT) || 8787;
server.listen(port, '0.0.0.0', () => console.log('Sakan on :' + port));
