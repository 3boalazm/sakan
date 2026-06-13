import http from 'node:http';
import { handle } from './lib/handler.js';
import { envPresent } from './lib/firebase.js';

console.log('SERVER STARTED');
console.log('ENV CHECK FIREBASE_SERVICE_ACCOUNT:', envPresent());

const readBody = (req) =>
  new Promise((resolve) => {
    let d = '';

    req.on('data', (c) => (d += c));

    req.on('end', () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch {
        resolve({});
      }
    });

    req.on('error', () => resolve({}));
  });

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'missing_url' }));
    }

    const url = new URL(req.url, 'http://localhost');

    const path = url.pathname
      .replace(/^\/api(?=\/|$)/, '')
      .split('/')
      .filter(Boolean);

    const token =
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;

    const body =
      ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? await readBody(req)
        : {};

    let result;

    try {
      result = await handle({ method: req.method, path, body, token });
    } catch (err) {
      console.error('HANDLE ERROR:', err);

      res.writeHead(500, {
        'content-type': 'application/json',
      });

      return res.end(
        JSON.stringify({
          error: 'handle_crash',
          message: err?.message || 'unknown',
        })
      );
    }

    const status = result?.status || 200;
    const out = result?.body ?? null;

    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
    });

    return res.end(JSON.stringify(out));
  } catch (err) {
    console.error('SERVER CRASH:', err);

    res.writeHead(500, {
      'content-type': 'application/json',
    });

    return res.end(
      JSON.stringify({
        error: 'server_crash',
        message: err?.message || 'unknown',
      })
    );
  }
});

const port = Number(process.env.PORT) || 8787;

server.listen(port, '0.0.0.0', () =>
  console.log('Sakan API on :' + port)
);