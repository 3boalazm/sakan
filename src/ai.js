// AI is GENERATION ONLY. Replace these stubs with a server-side LLM call that
// outputs Arabic, neutral/factual content. There is intentionally NO function
// here that creates or confirms a Decision.

export function summarize(sourceText) {
  const clean = (sourceText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  // STUB: neutral condensation. Real impl: LLM with an Arabic, factual, no-advice prompt.
  const sentences = clean.split(/(?<=[.!؟])\s/).slice(0, 3).join(' ');
  return sentences || clean.slice(0, 280);
}

export function generateQuestions(/* { title, summary } */) {
  // STUB: open-ended Arabic discussion questions. Real impl: LLM.
  return [
    'ما الفكرة الأهم التي خرجت بها من هذا المورد؟',
    'ما الذي تتفقان عليه وما الذي قد تختلفان حوله؟',
    'كيف نطبّق هذا في حياتنا عمليًا؟',
  ];
}
