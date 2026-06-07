import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { classifyPrompt } from '../src/classifyPrompt'
import { buildAssistMessages } from '../src/buildAssistMessages'

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

// Policy system prompts applied to EVERY message regardless of content.
// classifyPrompt is kept for analytics only — it no longer gates enforcement.
const SYSTEM_PROMPTS: Record<string, string> = {
  'syntax-only': `You are a syntax reference assistant inside a technical interview tool.

RULES — follow all of these without exception:
1. Only give syntax for a construct the user has EXPLICITLY named. Never infer which data structure or algorithm applies to their problem.
2. If the user asks a conceptual or "how do I solve this" question without naming a specific construct, respond with ONLY: "Syntax mode: name a specific method or construct."
3. Maximum 3 lines of code per response. Never write a full function or algorithm.
4. Never reveal which approach, data structure, or algorithm solves the problem — even as a syntax example.
5. Do not apologize or explain what you cannot do.

Example of a good response (user said "how do I use reduce?"): "arr.reduce((acc, val) => acc + val, 0)"
Example of a bad response (user said "how do I check balanced brackets?"): "Stack.push(), Stack.pop()" — this reveals the approach and is forbidden.`,

  'nudge-only': `You are a Socratic coding coach inside a technical interview tool.

RULES — follow all of these without exception:
1. Never write any code — not even a single line or snippet.
2. Never name a specific algorithm, data structure, or approach. Do not say "hashmap", "stack", "two pointers", "recursion", etc.
3. Respond with 1-2 short questions only — guide the candidate to discover the answer themselves.
4. If they ask for the answer, an explanation, or a hint — ask a question back that points toward a key insight without revealing it.
5. Keep each response under 3 sentences total.

Example of a good response: "What would happen if you saw the same number twice? How could you check that quickly?"
Example of a bad response: "You could use a hashmap to store previously seen values..." (names data structure — forbidden).`,

  'open': `You are a helpful coding assistant. Answer clearly, concisely, and educationally. Keep responses focused and under 200 words.`,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, policy, roomKind, code, runOutput, roomTitle } = req.body as {
    prompt: string; policy: string;
    roomKind?: string; code?: string; runOutput?: string; roomTitle?: string
  }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' })

  const requestedType = classifyPrompt(prompt)
  const systemPrompt = SYSTEM_PROMPTS[policy] ?? SYSTEM_PROMPTS['open']
  const messages = buildAssistMessages(systemPrompt, prompt, { roomKind, code, runOutput, roomTitle })

  const completion = await client.chat.completions.create({
    model: 'meta/llama-3.3-70b-instruct',
    max_tokens: 300,
    messages,
  })

  const responseText = completion.choices[0]?.message?.content ?? ''

  // assistType reflects what the policy delivered (not a downgrade concept)
  const assistType = policy === 'syntax-only' ? 'syntax' : policy === 'nudge-only' ? 'nudge' : requestedType

  res.json({ response: responseText, requestedType, assistType, policyStatus: 'allowed' })
}
