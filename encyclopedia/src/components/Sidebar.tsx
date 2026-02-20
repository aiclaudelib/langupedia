import { useMemo } from 'react'
import type { Word } from '../types/word'

interface SidebarProps {
  words: Word[]
  searchQuery: string
  onSearchChange: (query: string) => void
  activeWord: string | null
  onWordClick: (word: string) => void
  open: boolean
}

export default function Sidebar({
  words,
  searchQuery,
  onSearchChange,
  activeWord,
  onWordClick,
  open,
}: SidebarProps) {
  const filteredWords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return words
    return words.filter((w) => w.word.toLowerCase().includes(q))
  }, [words, searchQuery])

  const groups = useMemo(() => {
    const map: Record<string, Word[]> = {}
    filteredWords.forEach((w) => {
      const letter = w.word.charAt(0).toUpperCase()
      if (!map[letter]) map[letter] = []
      map[letter].push(w)
    })
    return map
  }, [filteredWords])

  const sortedLetters = useMemo(() => Object.keys(groups).sort(), [groups])

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-header">
        <div className="word-count">{words.length} words</div>
        <div className="search-box">
          <span className="search-icon">&#x1F50D;</span>
          <input
            type="text"
            placeholder="Search..."
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <nav className="word-list">
        {filteredWords.length === 0 ? (
          <div style={{ padding: 20, color: '#6b5344', textAlign: 'center', fontStyle: 'italic' }}>
            No words found
          </div>
        ) : (
          sortedLetters.map((letter) => (
            <div key={letter}>
              <div className="word-list-letter">{letter}</div>
              {groups[letter].map((w) => (
                <a
                  key={w.word}
                  className={`word-list-item${activeWord === w.word ? ' active' : ''}`}
                  data-word={w.word}
                  onClick={(e) => {
                    e.preventDefault()
                    onWordClick(w.word)
                  }}
                >
                  {w.word}
                </a>
              ))}
            </div>
          ))
        )}
      </nav>
    </aside>
  )
}
