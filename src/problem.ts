export const ADD_TWO_NUMBERS = {
  title: 'Add Two Numbers',
  description: 'Write a function `add(a, b)` that returns the sum of two numbers.',
  example: 'add(2, 3) → 5',
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
}
