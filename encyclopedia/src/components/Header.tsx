import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { isStaticMode } from '../lib/dataProvider'

interface Props {
  title?: string
  subtitle?: string
  showBackLink?: boolean
  onEdit?: () => void
  onExport?: () => void
}

export default function Header({ title, subtitle, showBackLink, onEdit, onExport }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [dropdownOpen])

  return (
    <header className="header">
      {showBackLink && (
        <Link to="/" className="header-back">
          &larr; Projects
        </Link>
      )}
      <h1 className="header-title">{title || 'Lexicon'}</h1>
      {subtitle && <p className="header-subtitle">{subtitle}</p>}

      <div className="header-actions">
        {onExport && (
          <div className="header-share" ref={dropdownRef}>
            <button
              className="header-share-btn"
              onClick={() => setDropdownOpen((v) => !v)}
              title="Share"
              aria-label="Share"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="header-dropdown">
                <button
                  className="header-dropdown-item"
                  onClick={() => { onExport(); setDropdownOpen(false) }}
                >
                  Download Markdown
                </button>
              </div>
            )}
          </div>
        )}
        {onEdit && !isStaticMode && (
          <button className="header-edit" onClick={onEdit} title="Edit project">
            Edit
          </button>
        )}
      </div>
    </header>
  )
}
