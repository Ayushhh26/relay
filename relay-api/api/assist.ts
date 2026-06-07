import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { classifyPrompt } from '../src/classifyPrompt'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, policy } = req.body as { prompt: string; policy: string }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' })

  const requestedType = classifyPrompt(prompt)
  const shouldDowngrade = policy === 'syntax-only' && requestedType === 'solution-leaning'

  const systemPrompt = shouldDowngrade
    ? 'Answer ONLY with a brief syntax example or API signature. Max 3 lines of code. Do not write a full implementation or algorithm.'
    : policy === 'syntax-only'
      ? 'You are a helpful coding assistant. Keep answers focused on syntax and brief examples only.'
      : 'You are a helpful coding assistant. Keep answers focused and educational.'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const assistType = shouldDowngrade ? 'syntax' : requestedType
  const policyStatus = shouldDowngrade ? 'downgraded' : 'allowed'

  res.json({ response: responseText, requestedType, assistType, policyStatus })
}
