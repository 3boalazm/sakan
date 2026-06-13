// AI is GENERATION ONLY. Replace with a server-side Arabic LLM call. No path to decisions.

export function summarize(sourceText) {
  const clean = (sourceText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!؟])\s/).slice(0, 3).join(' ');
  return sentences || clean.slice(0, 280);
}

export function generateQuestions() {
  return [
    'ما الفكرة الأهم التي خرجت بها من هذا المورد؟',
    'ما الذي تتفقان عليه وما الذي قد تختلفان حوله؟',
    'كيف نطبّق هذا في حياتنا عمليًا؟',
  ];
}
