import { db, uid } from './db.js';

// Persist an audit event AND emit a structured log line. Single chokepoint for
// transitions, pairing actions, force-reveals, and decision lifecycle.
export function record(pairId, entity, entityId, type, { from = null, to = null, actor = null, meta = null } = {}) {
  db.prepare('INSERT INTO events(id,pair_id,entity,entity_id,type,from_state,to_state,actor,meta) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(uid(), pairId, entity, entityId, type, from, to, actor, meta ? JSON.stringify(meta) : null);
  log(type, { pairId, entity, entityId, from, to, actor, ...(meta || {}) });
}

export function log(event, fields = {}) {
  if (process.env.SAKAN_LOG === 'silent') return;
  // structured JSON to stderr — pipe to your log collector in production
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event, ...fields }) + '\n');
}

export function listEvents(pairId, entity, entityId) {
  return db.prepare('SELECT entity,entity_id,type,from_state,to_state,actor,meta,created_at FROM events WHERE pair_id=? AND entity=? AND entity_id=? ORDER BY rowid').all(pairId, entity, entityId);
}
