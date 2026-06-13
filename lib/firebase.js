// Lazy, safe Firebase init. Never throws at module load — so a missing/bad env
// var produces a CLEAN error the handler can return, instead of crashing the
// whole serverless function (which is what caused the opaque 500).
export const uid = () => globalThis.crypto.randomUUID();
export const code8 = () => uid().replace(/-/g, '').slice(0, 8).toUpperCase();

export let db = null;                       // live binding; set on first ensureDb()
export const envPresent = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;

export async function ensureDb() {
  if (db) return db;

  if (process.env.SAKAN_FAKE_FS === '1') {
    const { makeFakeDb } = await import('./fakeFirestore.js');
    db = makeFakeDb();
    return db;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { const e = new Error('FIREBASE_SERVICE_ACCOUNT env var is missing'); e.status = 500; e.code = 'FIREBASE_ENV_MISSING'; throw e; }

  let creds;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    creds = JSON.parse(json);
  } catch { const e = new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64'); e.status = 500; e.code = 'FIREBASE_ENV_BAD'; throw e; }

  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(creds) });
  db = admin.firestore();
  return db;
}
