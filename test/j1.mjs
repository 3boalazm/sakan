process.env.SAKAN_DB = ':memory:';
const { start } = await import('../src/server.js');
const server = await start(0);
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  \u2713 ' + msg); } else { fail++; console.log('  \u2717 ' + msg); } };
async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

console.log('\n— Pairing —');
const a = await call('POST', '/pair', { body: { email: 'mustafa@x', displayName: 'مصطفى' } });
ok(a.status === 200 && a.data.pairCode, 'Mustafa creates a pair, gets a code');
const A = a.data.token;
const b = await call('POST', '/pair/join', { body: { code: a.data.pairCode, email: 'doaa@x', displayName: 'ضحى' } });
ok(b.status === 200 && b.data.pairId === a.data.pairId, 'Doaa joins with the code (same pair)');
const B = b.data.token;

console.log('\n— J1 flow —');
const r = await call('POST', '/resources', { token: A, body: { title: 'الميثاق الغليظ', type: 'course', stage: 'engagement', sourceText: 'الزواج ميثاق غليظ بين الزوجين. يقوم على المودة والرحمة. ولكل من الزوجين حقوق وواجبات.' } });
ok(r.status === 200 && r.data.status === 'not_started', '1. Add resource → not_started');
const rid = r.data.id;

const sum = await call('POST', `/resources/${rid}/summary`, { token: A });
ok(sum.status === 200 && sum.data.content, '2. Generate summary (AI)');
const rdet = await call('GET', `/resources/${rid}`, { token: A });
ok(rdet.data.resource.status === 'in_progress', '   resource → in_progress');

const qs = await call('POST', `/resources/${rid}/questions/generate`, { token: A });
ok(qs.status === 200 && qs.data.length >= 1 && qs.data[0].state === 'open', '3. Generate questions → open');
const q1 = qs.data[0].id, q2 = qs.data[1].id;

const ra = await call('PUT', `/questions/${q1}/responses`, { token: A, body: { text: 'عهدٌ يلزمني بالرعاية.' } });
ok(ra.data.state === 'answered_by_one', '4. Mustafa answers → answered_by_one');

const peek = await call('GET', `/questions/${q1}/responses`, { token: B });
ok(peek.data.partner === null && peek.data.questionState === 'answered_by_one', '5. Reveal rule: Doaa cannot see Mustafa\u2019s answer yet');

const rb = await call('PUT', `/questions/${q1}/responses`, { token: B, body: { text: 'أمانٌ متبادل وثقة.' } });
ok(rb.data.state === 'ready_to_reveal', '   Doaa answers → ready_to_reveal');

const rev = await call('POST', `/questions/${q1}/reveal`, { token: A });
ok(rev.status === 200 && rev.data.state === 'revealed', '6. Reveal → revealed');
const both = await call('GET', `/questions/${q1}/responses`, { token: B });
ok(both.data.mine && both.data.partner, '   both answers now visible to both');

const dec = await call('POST', '/decisions', { token: A, body: { resourceId: rid, statement: 'نخصّص ليلة أسبوعية للحوار.', questionIds: [q1] } });
ok(dec.status === 200 && dec.data.state === 'draft', '7. Create decision → draft');
const did = dec.data.id;

const c1 = await call('POST', `/decisions/${did}/confirm`, { token: A });
ok(c1.data.state === 'draft', '   1 of 2 confirmations → still draft (not output yet)');
const c2 = await call('POST', `/decisions/${did}/confirm`, { token: B });
ok(c2.data.state === 'confirmed', '   2nd confirmation → CONFIRMED (final output)');

const after = await call('GET', `/resources/${rid}`, { token: A });
ok(after.data.resource.status === 'completed', '   resource → completed (only via confirmed decision)');
ok(after.data.questions.find(x => x.id === q1).state === 'decided', '   linked question → decided');

console.log('\n— Decision is the final artifact —');
const log = await call('GET', '/decisions', { token: B });
ok(log.data.length === 1 && log.data[0].state === 'confirmed', 'confirmed decision appears in the log for both partners');

console.log('\n— State transitions —');
const badReveal = await call('POST', `/questions/${q2}/reveal`, { token: A });
ok(badReveal.status === 409, 'reveal on an unanswered question rejected (409)');
const relock = await call('PUT', `/questions/${q1}/responses`, { token: A, body: { text: 'تعديل بعد الكشف' } });
ok(relock.status === 409 && relock.data.error.code === 'QUESTION_LOCKED', 'editing a response after reveal rejected (locked)');
const earlyDec = await call('POST', '/decisions', { token: A, body: { resourceId: rid, statement: 'سابق لأوانه', questionIds: [q2] } });
ok(earlyDec.status === 409 && earlyDec.data.error.code === 'NO_REVEALED_QUESTION', 'decision before discussion rejected');

console.log('\n— Pair isolation —');
const c = await call('POST', '/pair', { body: { email: 'other@x', displayName: 'زوج آخر' } });
const C = c.data.token;
const cross = await call('GET', `/resources/${rid}`, { token: C });
ok(cross.status === 404, 'another pair cannot read this pair\u2019s resource (404, no leak)');
const clist = await call('GET', '/resources', { token: C });
ok(Array.isArray(clist.data) && clist.data.length === 0, 'another pair sees none of this pair\u2019s data');
const noAuth = await call('GET', '/resources');
ok(noAuth.status === 401, 'no token → 401');

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
server.close();
process.exit(fail ? 1 : 0);
