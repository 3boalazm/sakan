// The state machine's single source of truth. With Firestore there are no DB
// triggers, so every state change must pass through assertTransition() inside a
// transaction. Same allow-list as the SQL version.
const ALLOWED = new Set([
  'resource:not_started>in_progress', 'resource:in_progress>completed', 'resource:completed>in_progress',
  'question:open>answered_by_one', 'question:answered_by_one>ready_to_reveal',
  'question:answered_by_one>revealed', 'question:ready_to_reveal>revealed',
  'question:revealed>decided', 'question:decided>revealed',
  'decision:draft>confirmed', 'decision:confirmed>revisited', 'decision:revisited>confirmed',
]);

export function assertTransition(entity, from, to) {
  if (from === to) return;
  if (!ALLOWED.has(`${entity}:${from}>${to}`)) {
    const e = new Error(`invalid ${entity} transition ${from} -> ${to}`);
    e.status = 409; e.code = 'INVALID_TRANSITION';
    throw e;
  }
}
