import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { classifyPrompt } from '../src/classifyPrompt'

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, policy } = req.body as { prompt: string; policy: string }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' })

  const requestedType = classifyPrompt(prompt)
  const isSolution = requestedType === 'solution-leaning'
  const shouldDowngradeToSyntax = policy === 'syntax-only' && isSolution
  const shouldDowngradeToNudge = policy === 'nudge-only' && isSolution
  const shouldDowngrade = shouldDowngradeToSyntax || shouldDowngradeToNudge

  const systemPrompt = shouldDowngradeToSyntax
    ? 'Answer ONLY with a brief syntax example or API signature. Max 3 lines of code. Do not write a full implementation or algorithm.'
    : shouldDowngradeToNudge
      ? 'You are a Socratic tutor. Ask 2-3 clarifying questions to guide the student to think through the problem themselves. Do NOT give the answer or write any solution code.'
      : policy === 'syntax-only'
        ? 'You are a helpful coding assistant. Keep answers focused on syntax and brief examples only.'
        : 'You are a helpful coding assistant. Keep answers focused and educational.'

  const completion = await client.chat.completions.create({
    model: 'meta/llama-3.3-70b-instruct',
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  })

  const responseText = completion.choices[0]?.message?.content ?? ''
  const assistType = shouldDowngradeToSyntax ? 'syntax' : shouldDowngradeToNudge ? 'nudge' : requestedType
  const policyStatus = shouldDowngrade ? 'downgraded' : 'allowed'

  res.json({ response: responseText, requestedType, assistType, policyStatus })
}
