import { useState } from 'react'
import { formatText } from '../utils/formatText'

interface WordHistoryProps {
  text: string
  knownTargets?: Set<string>
}

export default function WordHistory({ text, knownTargets }: WordHistoryProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`word-history${open ? ' open' : ''}`}>
      <button
        className="word-history-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="word-history-arrow">&#9654;</span> Word History
      </button>
      <div className="word-history-content">
        <div
          className="word-history-text has-dropcap"
          dangerouslySetInnerHTML={{ __html: formatText(text, { knownTargets }) }}
        />
      </div>
    </div>
  )
}
