import { slugify } from './slugify'

export interface FormatOptions {
  knownTargets?: Set<string>
}

const LINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g

function renderWikiLink(rawTarget: string, rawDisplay: string | undefined, known?: Set<string>): string {
  const target = rawTarget.trim()
  const display = (rawDisplay ?? target).trim()
  // Cross-project syntax reserved — render as plain text for now
  if (target.includes(':')) return `[[${rawTarget}${rawDisplay ? '|' + rawDisplay : ''}]]`
  const slug = slugify(target)
  const resolved = known ? known.has(target.toLowerCase()) : true
  const cls = resolved ? 'wiki-link' : 'wiki-link link-missing'
  if (!resolved) {
    return `<span class="${cls}" data-target="${target}">${display}</span>`
  }
  return `<a class="${cls}" href="#${slug}" data-target="${target}">${display}</a>`
}

export function formatText(text: string | null | undefined, opts: FormatOptions = {}): string {
  if (!text || typeof text !== 'string') return ''
  let result = text.replace(LINK_RE, (_, t: string, d: string | undefined) =>
    renderWikiLink(t, d, opts.knownTargets)
  )
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return result
}
