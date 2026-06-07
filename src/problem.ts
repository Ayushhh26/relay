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
  difficulty: 'easy' | 'medium' | 'hard'
  templates: Record<CodeLanguage, QuestionTemplates>
}

export const ADD_TWO_NUMBERS: InterviewQuestion = {
  id: 'add-two-numbers',
  title: 'Add Two Numbers',
  description: 'Write a function that returns the sum of two numbers.',
  example: 'add(2, 3) → 5',
  difficulty: 'easy',
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
  example: 'reverseString("hello") → "olleh"',
  difficulty: 'easy',
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

export const FIZZBUZZ: InterviewQuestion = {
  id: 'fizzbuzz',
  title: 'FizzBuzz',
  description: 'Return an array of strings 1–n. Multiples of 3 → "Fizz", multiples of 5 → "Buzz", both → "FizzBuzz".',
  example: 'fizzBuzz(5) → ["1","2","Fizz","4","Buzz"]',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function fizzBuzz(n) {
  // return array of strings 1..n
  return [];
}`,
      runHarness: `
const result = fizzBuzz(15);
console.log('Output:', JSON.stringify(result));
const expected = ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'];
console.log('Expected:', JSON.stringify(expected));
if (JSON.stringify(result) === JSON.stringify(expected)) {
  console.log('✓ Passed');
} else {
  console.log('✗ Failed');
}
`,
    },
    python: {
      starterCode: `def fizz_buzz(n):
    # return list of strings 1..n
    return []
`,
      runHarness: `
result = fizz_buzz(15)
print('Output:', result)
expected = ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']
print('Expected:', expected)
if result == expected:
    print('✓ Passed')
else:
    print('✗ Failed')
`,
    },
  },
}

export const PALINDROME_CHECK: InterviewQuestion = {
  id: 'palindrome-check',
  title: 'Palindrome Check',
  description: 'Return true if the string reads the same forwards and backwards (ignore case).',
  example: 'isPalindrome("racecar") → true',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function isPalindrome(s) {
  // return true if s is a palindrome
  return false;
}`,
      runHarness: `
const cases = [['racecar', true], ['hello', false], ['Madam', true], ['A', true]];
let passed = 0;
for (const [input, expected] of cases) {
  const result = isPalindrome(input);
  const ok = result === expected;
  console.log(\`isPalindrome("\${input}") → \${result} (\${ok ? '✓' : '✗ expected ' + expected})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def is_palindrome(s):
    # return True if s is a palindrome
    return False
`,
      runHarness: `
cases = [('racecar', True), ('hello', False), ('Madam', True), ('A', True)]
passed = 0
for s, expected in cases:
    result = is_palindrome(s)
    ok = result == expected
    print(f'is_palindrome("{s}") → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const TWO_SUM: InterviewQuestion = {
  id: 'two-sum',
  title: 'Two Sum',
  description: 'Return the indices of the two numbers that add up to the target.',
  example: 'twoSum([2,7,11,15], 9) → [0,1]',
  difficulty: 'medium',
  templates: {
    javascript: {
      starterCode: `function twoSum(nums, target) {
  // return [i, j] where nums[i] + nums[j] === target
  return [];
}`,
      runHarness: `
const cases = [
  [[2,7,11,15], 9, [0,1]],
  [[3,2,4], 6, [1,2]],
  [[3,3], 6, [0,1]],
];
let passed = 0;
for (const [nums, target, expected] of cases) {
  const result = twoSum(nums, target);
  const ok = JSON.stringify(result.sort()) === JSON.stringify(expected.sort());
  console.log(\`twoSum(\${JSON.stringify(nums)}, \${target}) → \${JSON.stringify(result)} (\${ok ? '✓' : '✗ expected ' + JSON.stringify(expected)})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def two_sum(nums, target):
    # return [i, j] where nums[i] + nums[j] == target
    return []
`,
      runHarness: `
cases = [
    ([2,7,11,15], 9, [0,1]),
    ([3,2,4], 6, [1,2]),
    ([3,3], 6, [0,1]),
]
passed = 0
for nums, target, expected in cases:
    result = two_sum(nums, target)
    ok = sorted(result) == sorted(expected)
    print(f'two_sum({nums}, {target}) → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const VALID_PARENTHESES: InterviewQuestion = {
  id: 'valid-parentheses',
  title: 'Valid Parentheses',
  description: 'Return true if the string of brackets is valid (every open bracket has a matching close).',
  example: 'isValid("()[]{}") → true',
  difficulty: 'medium',
  templates: {
    javascript: {
      starterCode: `function isValid(s) {
  // return true if brackets are balanced
  return false;
}`,
      runHarness: `
const cases = [['()', true], ['()[]{} ', true], ['(]', false], ['([)]', false], ['{[]}', true]];
let passed = 0;
for (const [input, expected] of cases) {
  const result = isValid(input);
  const ok = result === expected;
  console.log(\`isValid("\${input}") → \${result} (\${ok ? '✓' : '✗ expected ' + expected})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def is_valid(s):
    # return True if brackets are balanced
    return False
`,
      runHarness: `
cases = [('()', True), ('()[]{}', True), ('(]', False), ('([)]', False), ('{[]}', True)]
passed = 0
for s, expected in cases:
    result = is_valid(s)
    ok = result == expected
    print(f'is_valid("{s}") → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const FIBONACCI: InterviewQuestion = {
  id: 'fibonacci',
  title: 'Fibonacci',
  description: 'Return the nth Fibonacci number (0-indexed: fib(0)=0, fib(1)=1).',
  example: 'fibonacci(6) → 8',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function fibonacci(n) {
  // return the nth Fibonacci number
  return 0;
}`,
      runHarness: `
const expected = [0,1,1,2,3,5,8,13,21,34];
let passed = 0;
for (let i = 0; i < expected.length; i++) {
  const result = fibonacci(i);
  const ok = result === expected[i];
  console.log(\`fibonacci(\${i}) → \${result} (\${ok ? '✓' : '✗ expected ' + expected[i]})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${expected.length} passed\`);
`,
    },
    python: {
      starterCode: `def fibonacci(n):
    # return the nth Fibonacci number
    return 0
`,
      runHarness: `
expected = [0,1,1,2,3,5,8,13,21,34]
passed = 0
for i, exp in enumerate(expected):
    result = fibonacci(i)
    ok = result == exp
    print(f'fibonacci({i}) → {result} ({"✓" if ok else "✗ expected " + str(exp)})')
    if ok:
        passed += 1
print(f'{passed}/{len(expected)} passed')
`,
    },
  },
}

export const FIND_MAX: InterviewQuestion = {
  id: 'find-max',
  title: 'Find Maximum',
  description: 'Return the largest number in an array without using built-in max functions.',
  example: 'findMax([3,1,4,1,5,9,2,6]) → 9',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function findMax(arr) {
  // return the largest element
  return 0;
}`,
      runHarness: `
const cases = [[[3,1,4,1,5,9,2,6], 9], [[-1,-5,-2], -1], [[42], 42]];
let passed = 0;
for (const [arr, expected] of cases) {
  const result = findMax(arr);
  const ok = result === expected;
  console.log(\`findMax(\${JSON.stringify(arr)}) → \${result} (\${ok ? '✓' : '✗ expected ' + expected})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def find_max(arr):
    # return the largest element
    return 0
`,
      runHarness: `
cases = [([3,1,4,1,5,9,2,6], 9), ([-1,-5,-2], -1), ([42], 42)]
passed = 0
for arr, expected in cases:
    result = find_max(arr)
    ok = result == expected
    print(f'find_max({arr}) → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const COUNT_VOWELS: InterviewQuestion = {
  id: 'count-vowels',
  title: 'Count Vowels',
  description: 'Return the number of vowels (a, e, i, o, u — case-insensitive) in the string.',
  example: 'countVowels("Hello World") → 3',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function countVowels(s) {
  // return count of vowels in s
  return 0;
}`,
      runHarness: `
const cases = [['Hello World', 3], ['rhythm', 0], ['aeiou', 5], ['JavaScript', 3]];
let passed = 0;
for (const [input, expected] of cases) {
  const result = countVowels(input);
  const ok = result === expected;
  console.log(\`countVowels("\${input}") → \${result} (\${ok ? '✓' : '✗ expected ' + expected})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def count_vowels(s):
    # return count of vowels in s
    return 0
`,
      runHarness: `
cases = [('Hello World', 3), ('rhythm', 0), ('aeiou', 5), ('JavaScript', 3)]
passed = 0
for s, expected in cases:
    result = count_vowels(s)
    ok = result == expected
    print(f'count_vowels("{s}") → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const ANAGRAM_CHECK: InterviewQuestion = {
  id: 'anagram-check',
  title: 'Anagram Check',
  description: 'Return true if two strings are anagrams of each other (same letters, any order, ignore case).',
  example: 'isAnagram("listen", "silent") → true',
  difficulty: 'medium',
  templates: {
    javascript: {
      starterCode: `function isAnagram(s, t) {
  // return true if s and t are anagrams
  return false;
}`,
      runHarness: `
const cases = [['listen','silent',true],['hello','world',false],['Anagram','nagaram',true],['rat','car',false]];
let passed = 0;
for (const [s, t, expected] of cases) {
  const result = isAnagram(s, t);
  const ok = result === expected;
  console.log(\`isAnagram("\${s}", "\${t}") → \${result} (\${ok ? '✓' : '✗ expected ' + expected})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def is_anagram(s, t):
    # return True if s and t are anagrams
    return False
`,
      runHarness: `
cases = [('listen','silent',True),('hello','world',False),('Anagram','nagaram',True),('rat','car',False)]
passed = 0
for s, t, expected in cases:
    result = is_anagram(s, t)
    ok = result == expected
    print(f'is_anagram("{s}", "{t}") → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const REMOVE_DUPLICATES: InterviewQuestion = {
  id: 'remove-duplicates',
  title: 'Remove Duplicates',
  description: 'Return a new array with duplicate values removed, preserving original order.',
  example: 'removeDuplicates([1,2,2,3,1]) → [1,2,3]',
  difficulty: 'easy',
  templates: {
    javascript: {
      starterCode: `function removeDuplicates(arr) {
  // return array with duplicates removed
  return [];
}`,
      runHarness: `
const cases = [[[1,2,2,3,1],[1,2,3]],[[4,4,4],[4]],[[1,2,3],[1,2,3]],[[], []]];
let passed = 0;
for (const [input, expected] of cases) {
  const result = removeDuplicates(input);
  const ok = JSON.stringify(result) === JSON.stringify(expected);
  console.log(\`removeDuplicates(\${JSON.stringify(input)}) → \${JSON.stringify(result)} (\${ok ? '✓' : '✗ expected ' + JSON.stringify(expected)})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def remove_duplicates(arr):
    # return list with duplicates removed
    return []
`,
      runHarness: `
cases = [([1,2,2,3,1],[1,2,3]),([4,4,4],[4]),([1,2,3],[1,2,3]),([],[])]
passed = 0
for arr, expected in cases:
    result = remove_duplicates(arr)
    ok = result == expected
    print(f'remove_duplicates({arr}) → {result} ({"✓" if ok else "✗ expected " + str(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const LONGEST_COMMON_PREFIX: InterviewQuestion = {
  id: 'longest-common-prefix',
  title: 'Longest Common Prefix',
  description: 'Return the longest string that is a prefix of all strings in the array.',
  example: 'longestCommonPrefix(["flower","flow","flight"]) → "fl"',
  difficulty: 'medium',
  templates: {
    javascript: {
      starterCode: `function longestCommonPrefix(strs) {
  // return the longest common prefix
  return '';
}`,
      runHarness: `
const cases = [
  [['flower','flow','flight'], 'fl'],
  [['dog','racecar','car'], ''],
  [['interview','interact','internal'], 'inter'],
  [['same','same','same'], 'same'],
];
let passed = 0;
for (const [strs, expected] of cases) {
  const result = longestCommonPrefix(strs);
  const ok = result === expected;
  console.log(\`longestCommonPrefix(\${JSON.stringify(strs)}) → "\${result}" (\${ok ? '✓' : '✗ expected "' + expected + '"'})\`);
  if (ok) passed++;
}
console.log(\`\${passed}/\${cases.length} passed\`);
`,
    },
    python: {
      starterCode: `def longest_common_prefix(strs):
    # return the longest common prefix
    return ''
`,
      runHarness: `
cases = [
    (['flower','flow','flight'], 'fl'),
    (['dog','racecar','car'], ''),
    (['interview','interact','internal'], 'inter'),
    (['same','same','same'], 'same'),
]
passed = 0
for strs, expected in cases:
    result = longest_common_prefix(strs)
    ok = result == expected
    print(f'longest_common_prefix({strs}) → "{result}" ({"✓" if ok else "✗ expected " + repr(expected)})')
    if ok:
        passed += 1
print(f'{passed}/{len(cases)} passed')
`,
    },
  },
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  ADD_TWO_NUMBERS,
  REVERSE_STRING,
  FIZZBUZZ,
  PALINDROME_CHECK,
  COUNT_VOWELS,
  REMOVE_DUPLICATES,
  FIBONACCI,
  FIND_MAX,
  TWO_SUM,
  ANAGRAM_CHECK,
  VALID_PARENTHESES,
  LONGEST_COMMON_PREFIX,
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
