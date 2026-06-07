import { useEffect, useReducer, useRef, type CSSProperties, type ReactNode } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import {
  parseNotepadContent,
  serializeNotepadContent,
  notepadDocsEqual,
} from './notepadContent'
import { notepadExtensions } from './notepadExtensions'

interface Props {
  value: string
  onChange?: (json: string) => void
  readOnly?: boolean
}

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
  testId,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      style={{
        ...styles.toolBtn,
        background: active ? '#2563eb' : '#1a1a1a',
        borderColor: active ? '#3b82f6' : '#2a2a2a',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function ToolbarSep() {
  return <span style={styles.sep} aria-hidden />
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const update = () => refresh()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  function setLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const headingValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
      ? '2'
      : editor.isActive('heading', { level: 3 })
        ? '3'
        : 'p'

  return (
    <div style={styles.toolbar} role="toolbar" aria-label="Formatting">
      <ToolbarButton
        title="Undo"
        disabled={!editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </ToolbarButton>

      <ToolbarSep />

      <select
        title="Heading"
        value={headingValue}
        onChange={e => {
          const v = e.target.value
          if (v === 'p') editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run()
        }}
        style={styles.select}
      >
        <option value="p">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <ToolbarSep />

      <ToolbarButton title="Bold" active={editor.isActive('bold')} testId="notepad-bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive('italic')} testId="notepad-italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive('underline')} testId="notepad-underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>U</ToolbarButton>
      <ToolbarButton title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>H</ToolbarButton>

      <ToolbarSep />

      <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} testId="notepad-insertUnorderedList" onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} testId="notepad-insertOrderedList" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
      <ToolbarButton title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</ToolbarButton>

      <ToolbarSep />

      <ToolbarButton title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>{'</>'}</ToolbarButton>
      <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</ToolbarButton>
      <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo;</ToolbarButton>
      <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>🔗</ToolbarButton>

      <ToolbarSep />

      <ToolbarButton title="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>x²</ToolbarButton>
      <ToolbarButton title="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>x₂</ToolbarButton>

      <ToolbarSep />

      <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>≡</ToolbarButton>
      <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>≣</ToolbarButton>
      <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>≡</ToolbarButton>
      <ToolbarButton title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>☰</ToolbarButton>
    </div>
  )
}

export function NotepadEditor({ value, onChange, readOnly = false }: Props) {
  const lastEmitted = useRef(value)

  const editor = useEditor({
    extensions: notepadExtensions(),
    content: parseNotepadContent(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        'data-testid': 'editor',
        class: 'notepad-prosemirror',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = serializeNotepadContent(ed.getJSON())
      lastEmitted.current = json
      onChange?.(json)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor) return
    if (notepadDocsEqual(value, lastEmitted.current)) return
    const doc = parseNotepadContent(value)
    lastEmitted.current = serializeNotepadContent(doc)
    editor.commands.setContent(doc, { emitUpdate: false })
  }, [value, editor])

  if (!editor) {
    return <div style={styles.wrapper} data-testid="editor-loading" />
  }

  return (
    <div style={styles.wrapper}>
      {!readOnly && <Toolbar editor={editor} />}
      <div style={styles.editorScroll}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    background: '#121212',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    borderBottom: '1px solid #1a1a1a',
    background: '#141414',
    flexShrink: 0,
  },
  sep: {
    width: 1,
    height: 22,
    background: '#2a2a2a',
    margin: '0 2px',
    flexShrink: 0,
  },
  select: {
    height: 28,
    padding: '0 8px',
    borderRadius: 6,
    border: '1px solid #2a2a2a',
    background: '#1a1a1a',
    color: '#e2e8f0',
    fontSize: 11,
    cursor: 'pointer',
  },
  toolBtn: {
    minWidth: 28,
    height: 28,
    padding: '0 7px',
    borderRadius: 6,
    border: '1px solid #2a2a2a',
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: 600,
  },
  editorScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
}
