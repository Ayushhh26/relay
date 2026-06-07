export type PromptType = 'syntax' | 'nudge' | 'solution-leaning'

const SOLUTION_KEYWORDS = [
  'full solution', 'complete solution', 'solve this', 'write the code',
  'write me', 'implement this', 'full implementation', 'just give me',
  'do it for me', 'complete the function', 'write the function',
  'can you write', 'write a function', 'give me the answer',
  'give me the full', 'write the complete',
]

const NUDGE_KEYWORDS = [
  'how do i', 'how to', 'what approach', 'algorithm', 'logic', 'explain',
  'what logic',
]

export function classifyPrompt(prompt: string): PromptType {
  const lower = prompt.toLowerCase()
  if (SOLUTION_KEYWORDS.some(kw => lower.includes(kw))) return 'solution-leaning'
  if (NUDGE_KEYWORDS.some(kw => lower.includes(kw))) return 'nudge'
  return 'syntax'
}
