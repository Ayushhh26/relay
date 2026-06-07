import { describe, it, expect } from 'vitest'
import { classifyPrompt } from '../../relay-api/src/classifyPrompt'

describe('classifyPrompt', () => {
  it('classifies syntax questions as syntax', () => {
    expect(classifyPrompt('what is Map syntax')).toBe('syntax')
    expect(classifyPrompt('Map syntax in JS')).toBe('syntax')
    expect(classifyPrompt('array destructuring syntax')).toBe('syntax')
  })

  it('classifies how-to questions as nudge', () => {
    expect(classifyPrompt('how do i iterate an array')).toBe('nudge')
    expect(classifyPrompt('how to use reduce')).toBe('nudge')
    expect(classifyPrompt('what approach should I take')).toBe('nudge')
    expect(classifyPrompt('explain the algorithm')).toBe('nudge')
    expect(classifyPrompt('what logic should I use here')).toBe('nudge')
  })

  it('classifies solution requests as solution-leaning', () => {
    expect(classifyPrompt('write the complete solution')).toBe('solution-leaning')
    expect(classifyPrompt('give me the full solution')).toBe('solution-leaning')
    expect(classifyPrompt('full solution please')).toBe('solution-leaning')
    expect(classifyPrompt('implement this for me')).toBe('solution-leaning')
    expect(classifyPrompt('can you write a function that sums an array')).toBe('solution-leaning')
    expect(classifyPrompt('just give me the answer')).toBe('solution-leaning')
    expect(classifyPrompt('write me the code')).toBe('solution-leaning')
    expect(classifyPrompt('do it for me')).toBe('solution-leaning')
    expect(classifyPrompt('complete the function')).toBe('solution-leaning')
  })

  it('is case-insensitive', () => {
    expect(classifyPrompt('WRITE THE COMPLETE SOLUTION')).toBe('solution-leaning')
    expect(classifyPrompt('How Do I iterate')).toBe('nudge')
    expect(classifyPrompt('WHAT IS MAP SYNTAX')).toBe('syntax')
  })

  it('defaults to syntax for unrecognized prompts', () => {
    expect(classifyPrompt('hello')).toBe('syntax')
    expect(classifyPrompt('what does this mean')).toBe('syntax')
  })
})
