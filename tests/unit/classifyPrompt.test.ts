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
    expect(classifyPrompt('walk me through this')).toBe('nudge')
    expect(classifyPrompt('help me understand closures')).toBe('nudge')
    expect(classifyPrompt('give me a hint')).toBe('nudge')
    expect(classifyPrompt('what should I do here')).toBe('nudge')
  })

  it('classifies solution requests as solution-leaning', () => {
    // already covered
    expect(classifyPrompt('write the complete solution')).toBe('solution-leaning')
    expect(classifyPrompt('give me the full solution')).toBe('solution-leaning')
    expect(classifyPrompt('full solution please')).toBe('solution-leaning')
    expect(classifyPrompt('implement this for me')).toBe('solution-leaning')
    expect(classifyPrompt('can you write a function that sums an array')).toBe('solution-leaning')
    expect(classifyPrompt('just give me the answer')).toBe('solution-leaning')
    expect(classifyPrompt('write me the code')).toBe('solution-leaning')
    expect(classifyPrompt('do it for me')).toBe('solution-leaning')
    expect(classifyPrompt('complete the function')).toBe('solution-leaning')
    // natural variants that were missing
    expect(classifyPrompt('give me the solution')).toBe('solution-leaning')
    expect(classifyPrompt('give me a solution')).toBe('solution-leaning')
    expect(classifyPrompt('solve it for me')).toBe('solution-leaning')
    expect(classifyPrompt('solve it')).toBe('solution-leaning')
    expect(classifyPrompt('write the solution')).toBe('solution-leaning')
    expect(classifyPrompt('show me the solution')).toBe('solution-leaning')
    expect(classifyPrompt('code it for me')).toBe('solution-leaning')
    expect(classifyPrompt('build this for me')).toBe('solution-leaning')
    expect(classifyPrompt('write it for me')).toBe('solution-leaning')
    expect(classifyPrompt('solve the problem')).toBe('solution-leaning')
  })

  it('is case-insensitive', () => {
    expect(classifyPrompt('WRITE THE COMPLETE SOLUTION')).toBe('solution-leaning')
    expect(classifyPrompt('How Do I iterate')).toBe('nudge')
    expect(classifyPrompt('WHAT IS MAP SYNTAX')).toBe('syntax')
    expect(classifyPrompt('SOLVE IT FOR ME')).toBe('solution-leaning')
  })

  it('defaults to syntax for unrecognized prompts', () => {
    expect(classifyPrompt('hello')).toBe('syntax')
    expect(classifyPrompt('what does this mean')).toBe('syntax')
  })
})
