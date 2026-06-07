type AssistMessage = { role: 'system' | 'user'; content: string }

// Accepts the already-computed systemPrompt from assist.ts (policy + downgrade already applied).
// Only adds code/terminal context into the user message for study rooms.
export function buildAssistMessages(
  systemPrompt: string,
  prompt: string,
  opts: { roomKind?: string; code?: string; runOutput?: string; roomTitle?: string }
): AssistMessage[] {
  if (opts.roomKind !== 'study') {
    return [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]
  }

  const contextParts: string[] = []
  if (opts.roomTitle) contextParts.push(`Session: ${opts.roomTitle}`)
  if (opts.code?.trim()) contextParts.push(`Current code:\n\`\`\`\n${opts.code}\n\`\`\``)
  if (opts.runOutput?.trim()) contextParts.push(`Terminal output:\n\`\`\`\n${opts.runOutput}\n\`\`\``)

  const userContent = contextParts.length > 0
    ? `${contextParts.join('\n\n')}\n\nQuestion: ${prompt}`
    : prompt

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userContent },
  ]
}
