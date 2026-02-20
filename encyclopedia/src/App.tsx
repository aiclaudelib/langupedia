import { useState, useEffect, useCallback, useRef } from 'react'
import type { Word } from './types/word'
import { slugify } from './utils/slugify'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import WordCard from './components/WordCard'
import HamburgerButton from './components/HamburgerButton'
import ScrollTopButton from './components/ScrollTopButton'

const DEFAULT_LANG = 'ru'
const STORAGE_KEY = 'lexicon-lang'

function getDataPath(lang: string) {
  return `data/words.${lang}.json`
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG)
  const [words, setWords] = useState<Word[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Load words when language changes
  useEffect(() => {
    fetch(getDataPath(lang))
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load words.${lang}.json`)
        return res.json()
      })
      .then((data: Word[]) => {
        const sorted = data.sort((a, b) =>
          a.word.toLowerCase().localeCompare(b.word.toLowerCase())
        )
        setWords(sorted)
        setSearchQuery('')
      })
  }, [lang])

  // Scroll handler: active word tracking + scroll-to-top visibility
  const handleScroll = useCallback(() => {
    const main = mainRef.current
    if (!main) return

    setShowScrollTop(main.scrollTop > 400)

    const scrollPos = main.scrollTop + 100
    const cards = document.querySelectorAll<HTMLElement>('.word-card')
    let active: string | null = null
    for (let i = cards.length - 1; i >= 0; i--) {
      if (cards[i].offsetTop <= scrollPos) {
        active = cards[i].dataset.word || null
        break
      }
    }
    setActiveWord(active)
  }, [])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    main.addEventListener('scroll', handleScroll)
    return () => main.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleLangChange = useCallback((newLang: string) => {
    if (newLang !== lang) {
      localStorage.setItem(STORAGE_KEY, newLang)
      setLang(newLang)
    }
  }, [lang])

  const scrollToCard = useCallback((word: string) => {
    const main = mainRef.current
    if (!main) return
    const el = document.getElementById(`card-${slugify(word)}`)
    if (!el) return
    const top = el.getBoundingClientRect().top + main.scrollTop - 20
    main.scrollTo({ top, behavior: 'smooth' })
    setSidebarOpen(false)
  }, [])

  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <>
      <Sidebar
        words={words}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeWord={activeWord}
        onWordClick={scrollToCard}
        open={sidebarOpen}
      />

      <HamburgerButton active={sidebarOpen} onClick={toggleSidebar} />
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={closeSidebar}
      />

      <main className="main" ref={mainRef}>
        <Header />

        <section className="cards-container">
          {words.map((w, i) => (
            <div key={w.word}>
              {i > 0 && (
                <div className="card-divider">&#10087;</div>
              )}
              <WordCard word={w} lang={lang} onLangChange={handleLangChange} />
            </div>
          ))}
        </section>

        <footer className="footer">
          <p>Compiled in the Year of Our Lord MMXXVI</p>
        </footer>
      </main>

      <ScrollTopButton visible={showScrollTop} onClick={scrollToTop} />
    </>
  )
}
