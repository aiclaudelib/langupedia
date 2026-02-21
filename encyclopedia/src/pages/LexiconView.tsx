import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { Word } from '../types/word'
import type { Project } from '../types/project'
import { queryKeys } from '../lib/queryKeys'
import { fetchProject, fetchWords } from '../lib/dataProvider'
import { slugify } from '../utils/slugify'
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
  const mainRef = useRef<HTMLElement>(null)

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
    if (active) {
      const slug = slugify(active)
      if (window.location.hash !== `#${slug}`) {
        history.replaceState(null, '', `#${slug}`)
      }
    }
  }, [])

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
    const main = mainRef.current
    if (!main) return
    const slug = slugify(word)
    const el = document.getElementById(`card-${slug}`)
    if (!el) return
    const top = el.getBoundingClientRect().top + main.scrollTop - 20
    main.scrollTo({ top, behavior: 'smooth' })
    setSidebarOpen(false)
    history.replaceState(null, '', `#${slug}`)
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

  // Attach scroll handler
  const mainRefCallback = useCallback((node: HTMLElement | null) => {
    // Clean up old listener
    const oldMain = mainRef.current
    if (oldMain) {
      oldMain.removeEventListener('scroll', handleScroll)
    }
    mainRef.current = node
    if (node) {
      node.addEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  const initialHashHandled = useRef(false)

  useEffect(() => {
    if (words.length === 0 || initialHashHandled.current) return
    initialHashHandled.current = true
    const hash = window.location.hash.slice(1)
    if (!hash) return
    setTimeout(() => {
      const el = document.getElementById(`card-${hash}`)
      if (el && mainRef.current) {
        const top = el.getBoundingClientRect().top + mainRef.current.scrollTop - 20
        mainRef.current.scrollTo({ top, behavior: 'instant' })
      }
    }, 50)
  }, [words])

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

      <main className="main" ref={mainRefCallback}>
        <Header
          title={project?.title}
          subtitle={project?.subtitle}
          showBackLink
          onEdit={() => setShowEditModal(true)}
        />

        <section className="cards-container">
          {words.map((w, i) => (
            <div key={w.word}>
              {i > 0 && (
                <div className="card-divider">&#10087;</div>
              )}
              <WordCard word={w} lang={lang} onLangChange={handleLangChange} onListenClick={setYouglishWord} />
            </div>
          ))}
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
