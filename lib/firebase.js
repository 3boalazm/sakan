// Credentials/store selected by env so the SAME code runs on Vercel and Railway.
// FIREBASE_SERVICE_ACCOUNT = the service-account JSON (single-line string).
// SAKAN_FAKE_FS=1 swaps in an in-memory Firestore for local testing only.
export const uid = () => globalThis.crypto.randomUUID();
export const code8 = () => uid().replace(/-/g, '').slice(0, 8).toUpperCase();

let db;
if (process.env.SAKAN_FAKE_FS === '1') {
  const { makeFakeDb } = await import('./fakeFirestore.js');
  db = makeFakeDb();
} else {
  const admin = (await import('firebase-admin')).default;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is missing');
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  db = admin.firestore();
}
export { db };
