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
1. You may ONLY provide brief syntax reminders, method signatures, or API names.
2. Maximum 3 lines of code per response. Never write a full function or algorithm.
3. Never explain how to solve the problem or describe an approach.
4. If the user asks for a solution, explanation, or algorithm — respond with only a one-line syntax example relevant to their question and nothing else.
5. Do not apologize or explain what you cannot do. Just give the syntax.

Example of a good response: "Array.prototype.reduce: arr.reduce((acc, val) => acc + val, 0)"
Example of a bad response: any explanation of logic, approach, or full implementation.`,

  'nudge-only': `You are a Socratic coding coach inside a technical interview tool.

RULES — follow all of these without exception:
1. Never write any code — not even a single line or snippet.
2. Never state an algorithm, approach, or data structure to use.
3. Respond with 1-2 short questions that guide the candidate to discover the answer themselves.
4. If they ask for the answer or solution directly — ask a question back that points toward the key insight without revealing it.
5. Keep each response under 3 sentences.

Example of a good response: "What would happen if two numbers in the array are the same? How does that affect what you need to track?"
Example of a bad response: "You could use a hashmap to store..." (reveals the approach).`,

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
