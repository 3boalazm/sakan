import http from 'node:http';
import { handle } from './lib/handler.js';

const readBody = (req) =>
  new Promise((resolve) => {
    let d = '';

    req.on('data', (c) => (d += c));

    req.on('end', () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch (e) {
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

    // accept both "/pair" and "/api/pair"
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

    const result = await handle({
      method: req.method,
      path,
      body,
      token,
    });

    const status = result?.status || 200;
    const out = result?.body ?? null;

    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
    });

    return res.end(JSON.stringify(out));
  } catch (err) {
    console.error('SERVER_ERROR:', err);

    res.writeHead(500, {
      'content-type': 'application/json; charset=utf-8',
    });

    return res.end(
      JSON.stringify({
        error: 'internal_server_error',
        message: err?.message || 'unknown',
      })
    );
  }
});

const port = Number(process.env.PORT) || 8787;

server.listen(port, '0.0.0.0', () =>
  console.log('Sakan API on :' + port)
);