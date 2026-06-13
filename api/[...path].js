import { handle } from '../lib/handler.js';

export default async function handler(req, res) {
  const path = [].concat(req.query.path || []);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const { status, body: out } = await handle({ method: req.method, path, body, token });
  res.status(status).json(out);
}
