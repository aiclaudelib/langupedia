import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Word } from '../types/word'
import type { Project } from '../types/project'
import { queryKeys } from '../lib/queryKeys'
import { fetchProject, fetchWords } from '../lib/dataProvider'
import { slugify } from '../utils/slugify'
import { wordToMarkdown } from '../utils/wordToMarkdown'
import { downloadMarkdown } from '../utils/downloadMarkdown'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import WordCard from '../components/WordCard'
import HamburgerButton from '../components/HamburgerButton'
import ScrollTopButton from '../components/ScrollTopButton'
import ProjectFormModal from '../components/ProjectFormModal'
import YouglishModal from '../components/YouglishModal'
import { isStaticMode } from '../lib/dataProvider'

const DEFAULT_LANG = 'ru'

const route = getRouteApi('/projects/$projectId')

export default function LexiconView() {
  const { projectId } = route.useParams()
  const { lang: urlLang } = route.useSearch()
  const navigate = useNavigate({ from: '/projects/$projectId' })
  const storageKey = `lexicon-lang-${projectId}`

  const [lang, setLang] = useState(() =>
    urlLang || localStorage.getItem(storageKey) || DEFAULT_LANG
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [youglishWord, setYouglishWord] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLElement>(null)

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: (): Promise<Project> => fetchProject(projectId),
  })

  const { data: words = [] } = useQuery({
    queryKey: queryKeys.words.byProject(projectId, lang),
    queryFn: async (): Promise<Word[]> => {
      const data = await fetchWords(projectId, lang)
      return data.sort((a, b) =>
        a.word.toLowerCase().localeCompare(b.word.toLowerCase())
      )
    },
  })

  const virtualizer = useVirtualizer({
    count: words.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 500,
    overscan: 3,
  })

  const wordIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    words.forEach((w, i) => map.set(w.word, i))
    return map
  }, [words])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return

    setShowScrollTop(el.scrollTop > 400)

    const scrollPos = el.scrollTop + 100
    const items = virtualizer.getVirtualItems()
    let active: string | null = null
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].start <= scrollPos) {
        active = words[items[i].index]?.word ?? null
        break
      }
    }
    if (active) {
      setActiveWord(active)
      const slug = slugify(active)
      if (window.location.hash !== `#${slug}`) {
        history.replaceState(null, '', `#${slug}`)
      }
    }
  }, [virtualizer, words])

  const handleLangChange = useCallback((newLang: string) => {
    if (newLang !== lang) {
      localStorage.setItem(storageKey, newLang)
      setLang(newLang)
      navigate({
        search: { lang: newLang },
        hash: window.location.hash,
        replace: true,
      })
    }
  }, [lang, storageKey, navigate])

  const scrollToCard = useCallback((word: string) => {
    const idx = wordIndexMap.get(word)
    if (idx !== undefined) {
      virtualizer.scrollToIndex(idx, { align: 'start' })
      setSidebarOpen(false)
      history.replaceState(null, '', `#${slugify(word)}`)
    }
  }, [wordIndexMap, virtualizer])

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleExportAll = useCallback(() => {
    const md = words.map((w) => wordToMarkdown(w)).join('\n---\n\n')
    downloadMarkdown(md, `${projectId}-${lang}.md`)
  }, [words, projectId, lang])

  const initialHashHandled = useRef(false)

  useEffect(() => {
    if (words.length === 0 || initialHashHandled.current) return
    initialHashHandled.current = true
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const idx = words.findIndex(w => slugify(w.word) === hash)
    if (idx >= 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(idx, { align: 'start' })
      })
    }
  }, [words, virtualizer])

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

      <main className="main" ref={scrollContainerRef} onScroll={handleScroll}>
        <Header
          title={project?.title}
          subtitle={project?.subtitle}
          showBackLink
          onEdit={() => setShowEditModal(true)}
          onExport={handleExportAll}
        />

        <section className="cards-container">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const w = words[vItem.index]
              return (
                <div
                  key={w.word}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  {vItem.index > 0 && <div className="card-divider">&#10087;</div>}
                  <WordCard word={w} lang={lang} onLangChange={handleLangChange} onListenClick={setYouglishWord} />
                </div>
              )
            })}
          </div>
        </section>

        <footer className="footer">
          <p>Compiled in the Year of Our Lord MMXXVI</p>
        </footer>
      </main>

      <ScrollTopButton visible={showScrollTop} onClick={scrollToTop} />

      {youglishWord && (
        <YouglishModal word={youglishWord} onClose={() => setYouglishWord(null)} />
      )}

      {!isStaticMode && showEditModal && project && (
        <ProjectFormModal
          project={project}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
