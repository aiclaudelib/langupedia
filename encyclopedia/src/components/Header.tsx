import { Link } from '@tanstack/react-router'
import { isStaticMode } from '../lib/dataProvider'

interface Props {
  title?: string
  subtitle?: string
  showBackLink?: boolean
  onEdit?: () => void
}

export default function Header({ title, subtitle, showBackLink, onEdit }: Props) {
  return (
    <header className="header">
      {showBackLink && (
        <Link to="/" className="header-back">
          &larr; Projects
        </Link>
      )}
      <h1 className="header-title">{title || 'Lexicon'}</h1>
      {subtitle && <p className="header-subtitle">{subtitle}</p>}
      {onEdit && !isStaticMode && (
        <button className="header-edit" onClick={onEdit} title="Edit project">
          Edit
        </button>
      )}
    </header>
  )
}
