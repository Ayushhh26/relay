import type { CSSProperties } from 'react'
import type { InterviewQuestion } from './problem'

interface Props {
  question: InterviewQuestion | undefined
}

export function QuestionPanel({ question }: Props) {
  if (!question) {
    return (
      <div data-testid="question-panel" style={styles.waiting}>
        Waiting for interviewer to pick a question…
      </div>
    )
  }

  return (
    <div data-testid="question-panel" style={styles.panel}>
      <div style={styles.titleRow}>
        <span style={styles.badge}>Question</span>
        <span style={styles.title}>{question.title}</span>
      </div>
      <div style={styles.description}>{question.description}</div>
      <div style={styles.example}>Example: {question.example}</div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  waiting: {
    padding: '12px 16px',
    background: '#121212',
    borderBottom: '1px solid #1a1a1a',
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  panel: {
    padding: '12px 16px',
    background: '#121212',
    borderBottom: '1px solid #1a1a1a',
    fontSize: 13,
    lineHeight: 1.5,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#93c5fd',
    background: '#172554',
    padding: '2px 6px',
    borderRadius: 4,
  },
  title: {
    fontWeight: 600,
    color: '#f8fafc',
  },
  description: {
    color: '#cbd5e1',
  },
  example: {
    marginTop: 6,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#64748b',
  },
}
