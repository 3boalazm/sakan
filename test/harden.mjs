process.env.SAKAN_DB = ':memory:';
const { start } = await import('../src/server.js');
const { db } = await import('../src/db.js');
const server = await start(0);
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } };
async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// --- setup: a pair + a resource walked to a confirmed decision ---
const A = (await call('POST', '/pair', { body: { email: 'm@x', displayName: 'مصطفى' } })).data;
const B = (await call('POST', '/pair/join', { body: { code: A.pairCode, email: 'd@x', displayName: 'ضحى' } })).data;
const rid = (await call('POST', '/resources', { token: A.token, body: { title: 'مورد', sourceText: 'نص المصدر. جملة ثانية.' } })).data.id;
await call('POST', `/resources/${rid}/summary`, { token: A.token });
const qs = (await call('POST', `/resources/${rid}/questions/generate`, { token: A.token })).data;
const q1 = qs[0].id, q2 = qs[1].id;
await call('PUT', `/questions/${q1}/responses`, { token: A.token, body: { text: 'أ' } });
await call('PUT', `/questions/${q1}/responses`, { token: B.token, body: { text: 'ب' } });
await call('POST', `/questions/${q1}/reveal`, { token: A.token });

console.log('\n— A) Audit log + event history —');
const rEvents = (await call('GET', `/resources/${rid}/events`, { token: A.token })).data;
const types = rEvents.map((e) => `${e.entity}:${e.type}`);
ok(types.includes('resource:created'), 'resource creation is audited');
ok(types.includes('resource:transition') && rEvents.some((e) => e.to_state === 'in_progress'), 'resource not_started→in_progress audited');
ok(types.filter((t) => t === 'question:transition').length >= 2, 'question transitions audited (open→answered_by_one→ready_to_reveal)');
const qEvents = (await call('GET', `/questions/${q1}/events`, { token: A.token })).data;
ok(qEvents.length >= 3 && qEvents[0].type === 'created', 'per-question event history present and ordered');

console.log('\n— A) Force-reveal is stored explicitly —');
await call('PUT', `/questions/${q2}/responses`, { token: A.token, body: { text: 'أ فقط' } }); // only one answers
const forced = (await call('POST', `/questions/${q2}/force-reveal`, { token: B.token })).data;
ok(forced.state === 'revealed' && forced.reveal_method === 'force', 'force-reveal sets reveal_method=force');
ok(forced.reveal_by === B.userId, 'force-reveal stores who forced it (reveal_by)');
const fEvents = (await call('GET', `/questions/${q2}/events`, { token: A.token })).data;
ok(fEvents.some((e) => e.type === 'force_reveal' && e.actor === B.userId), 'force_reveal event recorded with actor');

console.log('\n— A) Decision immutable after confirmed —');
const d = (await call('POST', '/decisions', { token: A.token, body: { resourceId: rid, statement: 'قرار', questionIds: [q1] } })).data;
await call('POST', `/decisions/${d.id}/confirm`, { token: A.token });
await call('POST', `/decisions/${d.id}/confirm`, { token: B.token }); // now confirmed
let immutable = false;
try { db.prepare("UPDATE decisions SET statement='عبث' WHERE id=?").run(d.id); }
catch { immutable = true; }
ok(immutable, 'DB rejects edits to a confirmed decision (trigger)');
let undeletable = false;
try { db.prepare('DELETE FROM decisions WHERE id=?').run(d.id); }
catch { undeletable = true; }
ok(undeletable, 'DB rejects deletion of a confirmed decision');

console.log('\n— B) Concurrency / consistency —');
// reveal race: two simultaneous reveals on a ready question — second is idempotent, not an error
const q3 = qs[2].id;
await call('PUT', `/questions/${q3}/responses`, { token: A.token, body: { text: 'أ' } });
await call('PUT', `/questions/${q3}/responses`, { token: B.token, body: { text: 'ب' } });
const revA = await call('POST', `/questions/${q3}/reveal`, { token: A.token });
const revB = await call('POST', `/questions/${q3}/reveal`, { token: B.token });
ok(revA.status === 200 && revB.status === 200 && revB.data.state === 'revealed', 'double reveal is idempotent (200, not conflict)');
// double-confirm by same user: no extra confirmation, state stable
const dc = await call('POST', '/decisions', { token: A.token, body: { resourceId: rid, statement: 'ق2', questionIds: [q1] } });
await call('POST', `/decisions/${dc.data.id}/confirm`, { token: A.token });
const again = await call('POST', `/decisions/${dc.data.id}/confirm`, { token: A.token });
const confCount = db.prepare('SELECT count(*) c FROM decision_confirmations WHERE decision_id=?').get(dc.data.id).c;
ok(again.data.state === 'draft' && confCount === 1, 'same user confirming twice counts once (still draft)');
// duplicate decision creation deduped by idempotency key
const k = 'idem-123';
const first = await call('POST', '/decisions', { token: A.token, body: { resourceId: rid, statement: 'مرة', questionIds: [q1], idempotencyKey: k } });
const dup = await call('POST', '/decisions', { token: A.token, body: { resourceId: rid, statement: 'مرة', questionIds: [q1], idempotencyKey: k } });
const rows = db.prepare('SELECT count(*) c FROM decisions WHERE idempotency_key=?').get(k).c;
ok(first.data.id === dup.data.id && rows === 1, 'duplicate decision creation deduped via idempotency key');
// double answers: exactly two responses, exactly one of each transition event
const respCount = db.prepare('SELECT count(*) c FROM responses WHERE question_id=?').get(q1).c;
const t1 = qEvents.filter((e) => e.to_state === 'answered_by_one').length;
const t2 = qEvents.filter((e) => e.to_state === 'ready_to_reveal').length;
ok(respCount === 2 && t1 === 1 && t2 === 1, 'two answers → exactly one of each transition (no double-fire)');

console.log('\n— C) Structured logs —');
let logged = null;
const orig = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk) => { try { const o = JSON.parse(chunk); if (o.event) logged = o; } catch {} return true; };
await call('POST', `/decisions/${dc.data.id}/confirm`, { token: B.token }); // emits events
process.stderr.write = orig;
ok(logged && logged.event && logged.pairId && 'entity' in logged, 'structured JSON log emitted for events (event, pairId, entity)');

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
server.close();
process.exit(fail ? 1 : 0);
