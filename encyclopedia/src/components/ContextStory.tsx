import { useState } from 'react'
import { formatText } from '../utils/formatText'

interface ContextStoryProps {
  text: string
}

export default function ContextStory({ text }: ContextStoryProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`context-story${open ? ' open' : ''}`}>
      <button
        className="context-story-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="context-story-arrow">&#9654;</span> Context Story
      </button>
      <div className="context-story-content">
        <div
          className="context-story-text"
          dangerouslySetInnerHTML={{ __html: formatText(text) }}
        />
      </div>
    </div>
  )
}
