// Client-side API helper — mirrors the vanilla app's api() function

export function getToken()  { try { return localStorage.getItem('sakan_token'); } catch { return null; } }
export function setToken(t) { try { localStorage.setItem('sakan_token', t); }    catch {} }
export function clearToken(){ try { localStorage.removeItem('sakan_token'); }     catch {} }

export async function api(method, path, body) {
  const token = getToken();
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const code = data?.error?.code || ('HTTP_' + res.status);
    const e = new Error(code);
    e.code = code;
    e.status = res.status;
    throw e;
  }
  return data;
}

export const ERR_MSG = {
  UNAUTHENTICATED:   'انتهت الجلسة — سجّل دخولك تاني',
  BAD_CREDENTIALS:   'الإيميل أو الباسوورد غلط',
  EMAIL_TAKEN:       'الإيميل ده مستخدم — جرّب تسجّل الدخول',
  INVALID_CODE:      'الكود غير صحيح أو مُستخدَم',
  PAIR_FULL:         'هذا الميثاق مكتمل بطرفين',
  BAD_EMAIL:         'اكتب إيميل صحيح',
  WEAK_PASSWORD:     'الباسوورد لازم ٤ حروف على الأقل',
  QUESTION_LOCKED:   'السؤال أُغلق بعد الكشف',
  STATE_CONFLICT:    'لا يمكن الكشف قبل أن تجيبا كلاكما',
  NO_REVEALED_QUESTION: 'اكشفا سؤالًا واحدًا على الأقل أولاً',
  NO_QUESTIONS_LINKED:  'اختر سؤالًا واحدًا على الأقل',
};

export function errMsg(e) {
  return ERR_MSG[e?.code] || ('حدث خطأ: ' + (e?.code || 'غير معروف'));
}
