import type { CodeLanguage } from './languages'
import { STUDY_STARTERS } from './languages'

export interface QuestionTemplates {
  starterCode: string
  runHarness: string
}

export interface InterviewQuestion {
  id: string
  title: string
  description: string
  example: string
  templates: Record<CodeLanguage, QuestionTemplates>
}

export const ADD_TWO_NUMBERS: InterviewQuestion = {
  id: 'add-two-numbers',
  title: 'Add Two Numbers',
  description: 'Write a function that returns the sum of two numbers.',
  example: 'add(2, 3) → 5',
  templates: {
    javascript: {
      starterCode: `function add(a, b) {
  // return the sum of a and b
  return 0;
}`,
      runHarness: `
console.log('Running with hardcoded input: a=2, b=3');
const result = add(2, 3);
console.log('Output:', result);
console.log('Expected: 5');
if (result === 5) {
  console.log('✓ Passed');
} else {
  console.log('✗ Failed');
}
`,
    },
    python: {
      starterCode: `def add(a, b):
    # return the sum of a and b
    return 0
`,
      runHarness: `
print('Running with hardcoded input: a=2, b=3')
result = add(2, 3)
print('Output:', result)
print('Expected: 5')
if result == 5:
    print('✓ Passed')
else:
    print('✗ Failed')
`,
    },
  },
}

export const REVERSE_STRING: InterviewQuestion = {
  id: 'reverse-string',
  title: 'Reverse a String',
  description: 'Write a function that returns the reversed string.',
  example: 'reverseString("hello") → "olleh" / reverse_string("hello") → "olleh"',
  templates: {
    javascript: {
      starterCode: `function reverseString(s) {
  // return the reversed string
  return '';
}`,
      runHarness: `
const result = reverseString('hello');
console.log('Output:', result);
console.log('Expected: olleh');
if (result === 'olleh') {
  console.log('✓ Passed');
} else {
  console.log('✗ Failed');
}
`,
    },
    python: {
      starterCode: `def reverse_string(s):
    # return the reversed string
    return ''
`,
      runHarness: `
result = reverse_string('hello')
print('Output:', result)
print('Expected: olleh')
if result == 'olleh':
    print('✓ Passed')
else:
    print('✗ Failed')
`,
    },
  },
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  ADD_TWO_NUMBERS,
  REVERSE_STRING,
]

export function getQuestionById(id: string | undefined | null): InterviewQuestion | undefined {
  if (!id) return undefined
  return INTERVIEW_QUESTIONS.find(q => q.id === id)
}

export function getQuestionStarter(
  question: InterviewQuestion | undefined,
  lang: CodeLanguage,
  isStudy: boolean,
): string {
  if (isStudy) return STUDY_STARTERS[lang]
  if (!question) return STUDY_STARTERS[lang]
  return question.templates[lang].starterCode
}

export function getQuestionHarness(
  question: InterviewQuestion | undefined,
  lang: CodeLanguage,
): string | undefined {
  if (!question) return ADD_TWO_NUMBERS.templates[lang].runHarness
  return question.templates[lang].runHarness
}
