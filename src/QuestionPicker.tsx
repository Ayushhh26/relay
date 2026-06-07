import type { CSSProperties } from 'react'
import type { InterviewQuestion } from './problem'

interface Props {
  questions: InterviewQuestion[]
  selectedQuestionId: string
  onSelect: (question: InterviewQuestion) => void
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#4ade80',
  medium: '#fbbf24',
  hard: '#f87171',
}

export function QuestionPicker({ questions, selectedQuestionId, onSelect }: Props) {
  return (
    <div data-testid="question-picker" style={styles.wrapper}>
      <div style={styles.headerRow}>
        <span style={styles.label}>Select question</span>
        <span style={styles.count}>{questions.length} questions</span>
      </div>
      <div style={styles.list}>
        {questions.map(q => {
          const active = q.id === selectedQuestionId
          const diffColor = DIFFICULTY_COLOR[q.difficulty] ?? '#64748b'
          return (
            <button
              key={q.id}
              type="button"
              data-testid={`question-option-${q.id}`}
              onClick={() => onSelect(q)}
              style={{
                ...styles.option,
                borderColor: active ? '#2563eb' : '#2a2a2a',
                background: active ? '#172554' : '#111',
              }}
            >
              <div style={styles.optionTop}>
                <span style={styles.optionTitle}>{q.title}</span>
                <span style={{ ...styles.diffBadge, color: diffColor, borderColor: diffColor }}>
                  {q.difficulty}
                </span>
              </div>
              <span style={styles.optionHint}>{q.example}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    padding: '8px 14px',
    background: '#0d1117',
    borderBottom: '1px solid #1a1a1a',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  count: {
    fontSize: 11,
    color: '#374151',
  },
  list: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
    scrollbarWidth: 'thin',
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    minWidth: 190,
    maxWidth: 220,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2a2a2a',
    cursor: 'pointer',
    color: '#e2e8f0',
    textAlign: 'left',
    flexShrink: 0,
  },
  optionTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  diffBadge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    border: '1px solid',
    borderRadius: 4,
    padding: '1px 5px',
    flexShrink: 0,
  },
  optionHint: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
  },
}
