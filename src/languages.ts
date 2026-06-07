export const CODE_LANGUAGES = ['javascript', 'python'] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export function normalizeLanguage(value: string | undefined | null): CodeLanguage {
  return value === 'python' ? 'python' : 'javascript'
}

export function languageLabel(lang: CodeLanguage): string {
  return lang === 'python' ? 'Python' : 'JavaScript'
}

export function languageFileName(lang: CodeLanguage): string {
  return lang === 'python' ? 'main.py' : 'main.js'
}

export const STUDY_STARTERS: Record<CodeLanguage, string> = {
  javascript: `// Welcome to Relay
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));
`,
  python: `# Welcome to Relay
def greet(name):
    return f"Hello, {name}!"

print(greet("world"))
`,
}
