import type Database from 'better-sqlite3'
import type { Word, Definition, Comparison, Idiom, Collocation, RelatedForm } from '../../types/word'

export interface ExtractedLink {
  field: string
  lang: string
  targetLc: string
  display: string | null
}

const LINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g

export function extractLinksFromText(text: string | null | undefined, field: string, lang: string): ExtractedLink[] {
  if (!text || typeof text !== 'string') return []
  const out: ExtractedLink[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    // Cross-project syntax reserved for future
    if (raw.includes(':')) continue
    const targetLc = raw.toLowerCase()
    const display = m[2] ? m[2].trim() : null
    const key = `${field}|${lang}|${targetLc}|${display ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ field, lang, targetLc, display })
  }
  return out
}

function extractFromCollocations(cols: (string | Collocation)[] | undefined, lang: string): ExtractedLink[] {
  if (!cols) return []
  const out: ExtractedLink[] = []
  for (const c of cols) {
    const text = typeof c === 'string' ? c : (c.text ?? c.phrase ?? '')
    out.push(...extractLinksFromText(text, 'collocations', lang))
  }
  return out
}

export function extractAllLinks(word: Word, lang: string): ExtractedLink[] {
  const out: ExtractedLink[] = []

  if (word.definitions) {
    for (const d of word.definitions as Definition[]) {
      out.push(...extractLinksFromText(d.text, 'definitions', lang))
      out.push(...extractLinksFromText(d.context, 'definitions', lang))
      if (d.examples) for (const ex of d.examples) out.push(...extractLinksFromText(ex, 'definitions', lang))
    }
  }
  if (word.mainExamples) for (const ex of word.mainExamples) out.push(...extractLinksFromText(ex, 'mainExamples', lang))
  out.push(...extractLinksFromText(word.usageNote, 'usageNote', lang))
  if (word.comparisons) for (const c of word.comparisons as Comparison[]) {
    out.push(...extractLinksFromText(c.description, 'comparisons', lang))
  }
  out.push(...extractFromCollocations(word.collocations, lang))
  if (word.idioms) for (const i of word.idioms as Idiom[]) {
    out.push(...extractLinksFromText(i.explanation, 'idioms', lang))
  }
  if (word.relatedForms) for (const r of word.relatedForms as RelatedForm[]) {
    out.push(...extractLinksFromText(r.description, 'relatedForms', lang))
  }
  out.push(...extractLinksFromText(word.wordHistory, 'wordHistory', lang))
  out.push(...extractLinksFromText(word.contextStory, 'contextStory', lang))

  return out
}

export function rebuildLinksForWord(
  db: Database.Database,
  projectId: string,
  wordId: number,
  links: ExtractedLink[],
) {
  db.prepare('DELETE FROM word_links WHERE source_word_id = ?').run(wordId)
  if (links.length === 0) return
  const insert = db.prepare(`
    INSERT INTO word_links (project_id, source_word_id, lang, target_word_lc, target_word_id, field, display_text)
    VALUES (?, ?, ?, ?,
      (SELECT id FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?),
      ?, ?)
  `)
  for (const l of links) {
    insert.run(projectId, wordId, l.lang, l.targetLc, projectId, l.targetLc, l.field, l.display)
  }
}

export function resolveIncomingLinks(db: Database.Database, projectId: string, wordId: number, wordLc: string) {
  db.prepare(`
    UPDATE word_links
    SET target_word_id = ?
    WHERE project_id = ? AND target_word_lc = ? AND target_word_id IS NULL
  `).run(wordId, projectId, wordLc)
}

export function getBacklinks(db: Database.Database, wordId: number): Array<{ word: string; fields: string[] }> {
  const rows = db.prepare(`
    SELECT w.word AS word, GROUP_CONCAT(DISTINCT wl.field) AS fields
    FROM word_links wl
    JOIN words w ON w.id = wl.source_word_id
    WHERE wl.target_word_id = ?
    GROUP BY wl.source_word_id
    ORDER BY w.word COLLATE NOCASE
  `).all(wordId) as Array<{ word: string; fields: string }>
  return rows.map(r => ({ word: r.word, fields: (r.fields ?? '').split(',') }))
}

export function getBrokenLinks(db: Database.Database, projectId: string) {
  return db.prepare(`
    SELECT wl.target_word_lc AS target, w.word AS source, wl.field, wl.lang
    FROM word_links wl
    JOIN words w ON w.id = wl.source_word_id
    WHERE wl.project_id = ? AND wl.target_word_id IS NULL
    ORDER BY wl.target_word_lc, w.word
  `).all(projectId)
}
