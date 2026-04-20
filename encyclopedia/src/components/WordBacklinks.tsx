import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { slugify } from '../utils/slugify'
import { isStaticMode } from '../lib/dataProvider'

interface Backlink {
  word: string
  fields: string[]
}

interface WordBacklinksProps {
  projectId: string
  word: string
}

async function fetchBacklinks(projectId: string, word: string): Promise<Backlink[]> {
  const res = await fetch(`/api/projects/${projectId}/words/${encodeURIComponent(word)}/backlinks`)
  if (!res.ok) return []
  return res.json()
}

export default function WordBacklinks({ projectId, word }: WordBacklinksProps) {
  const [open, setOpen] = useState(false)

  const { data = [] } = useQuery({
    queryKey: ['backlinks', projectId, word],
    queryFn: () => fetchBacklinks(projectId, word),
    enabled: !isStaticMode,
  })

  if (isStaticMode || data.length === 0) return null

  return (
    <div className={`word-backlinks${open ? ' open' : ''}`}>
      <button
        className="word-backlinks-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="word-backlinks-arrow">&#9654;</span>
        Used in {data.length} article{data.length === 1 ? '' : 's'}
      </button>
      <div className="word-backlinks-content">
        {data.map((b) => (
          <a key={b.word} href={`#${slugify(b.word)}`}>{b.word}</a>
        ))}
      </div>
    </div>
  )
}
