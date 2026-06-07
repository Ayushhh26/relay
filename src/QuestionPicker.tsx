import type { CSSProperties } from 'react'
import type { InterviewQuestion } from './problem'

interface Props {
  questions: InterviewQuestion[]
  selectedQuestionId: string
  onSelect: (question: InterviewQuestion) => void
}

export function QuestionPicker({ questions, selectedQuestionId, onSelect }: Props) {
  return (
    <div data-testid="question-picker" style={styles.wrapper}>
      <div style={styles.label}>Select question</div>
      <div style={styles.list}>
        {questions.map(q => {
          const active = q.id === selectedQuestionId
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
              <span style={styles.optionTitle}>{q.title}</span>
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
    padding: '10px 14px',
    background: '#0d1117',
    borderBottom: '1px solid #1a1a1a',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 8,
  },
  list: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 2,
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    minWidth: 180,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2a2a2a',
    cursor: 'pointer',
    color: '#e2e8f0',
    textAlign: 'left',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: 600,
  },
  optionHint: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
}
