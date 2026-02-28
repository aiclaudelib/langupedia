import { useMemo, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Word } from '../types/word'
import { slugify } from '../utils/slugify'

interface SidebarProps {
  words: Word[]
  searchQuery: string
  onSearchChange: (query: string) => void
  activeWord: string | null
  onWordClick: (word: string) => void
  open: boolean
}

type FlatItem =
  | { type: 'letter'; letter: string }
  | { type: 'word'; word: Word }

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

  const flatList = useMemo(() => {
    const items: FlatItem[] = []
    sortedLetters.forEach(letter => {
      items.push({ type: 'letter', letter })
      groups[letter].forEach(w => items.push({ type: 'word', word: w }))
    })
    return items
  }, [sortedLetters, groups])

  const listRef = useRef<HTMLElement>(null)

  const virtualizer = useVirtualizer({
    count: flatList.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => flatList[i].type === 'letter' ? 32 : 34,
    overscan: 20,
  })

  useEffect(() => {
    if (!activeWord) return
    const idx = flatList.findIndex(
      item => item.type === 'word' && item.word.word === activeWord
    )
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center' })
    }
  }, [activeWord, flatList, virtualizer])

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
      <nav className="word-list" ref={listRef}>
        {flatList.length === 0 ? (
          <div style={{ padding: 20, color: '#6b5344', textAlign: 'center', fontStyle: 'italic' }}>
            No words found
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const item = flatList[vItem.index]
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  {item.type === 'letter' ? (
                    <div className="word-list-letter">{item.letter}</div>
                  ) : (
                    <a
                      href={`#${slugify(item.word.word)}`}
                      className={`word-list-item${activeWord === item.word.word ? ' active' : ''}`}
                      data-word={item.word.word}
                      onClick={(e) => {
                        e.preventDefault()
                        onWordClick(item.word.word)
                      }}
                    >
                      {item.word.word}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </nav>
    </aside>
  )
}
