export type PromptType = 'syntax' | 'nudge' | 'solution-leaning'

const SOLUTION_KEYWORDS = [
  // explicit solution asks
  'full solution', 'complete solution', 'give me the solution', 'give me a solution',
  'show me the solution', 'write the solution',
  // write / code / build for me
  'write the code', 'write me', 'write it for me', 'write a function', 'can you write',
  'write the complete', 'write the function',
  'code it for me', 'build this for me',
  // implement / solve
  'implement this', 'full implementation',
  'solve this', 'solve it', 'solve the problem',
  // just give / do it
  'just give me', 'give me the answer', 'give me the full',
  'do it for me', 'complete the function', 'complete this for me',
]

const NUDGE_KEYWORDS = [
  'how do i', 'how to',
  'what approach', 'what should i',
  'walk me through',
  'help me understand',
  'give me a hint',
  'algorithm', 'logic', 'what logic',
  'explain',
]

export function classifyPrompt(prompt: string): PromptType {
  const lower = prompt.toLowerCase()
  if (SOLUTION_KEYWORDS.some(kw => lower.includes(kw))) return 'solution-leaning'
  if (NUDGE_KEYWORDS.some(kw => lower.includes(kw))) return 'nudge'
  return 'syntax'
}
