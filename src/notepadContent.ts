import type { JSONContent } from '@tiptap/core'

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function emptyNotepadDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Parse stored document.content for notepad rooms (JSON, not HTML). */
export function parseNotepadContent(raw: string): JSONContent {
  if (!raw.trim()) return emptyNotepadDoc()
  try {
    const parsed = JSON.parse(raw) as JSONContent
    if (parsed?.type === 'doc') return parsed
  } catch {
    // Legacy plain-text notes from before TipTap — wrap in a paragraph.
  }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }],
  }
}

export function serializeNotepadContent(doc: JSONContent): string {
  return JSON.stringify(doc)
}

export function notepadDocsEqual(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a || '{}')) === JSON.stringify(JSON.parse(b || '{}'))
  } catch {
    return a === b
  }
}

export { EMPTY_DOC }
