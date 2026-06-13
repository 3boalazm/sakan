import { handle } from '../lib/handler.js';

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const path = [].concat(req.query.path || []);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const { status, body: out } = await handle({ method: req.method, path, body, token });
  res.status(status).json(out);
}
