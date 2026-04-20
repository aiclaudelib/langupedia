import type Database from 'better-sqlite3'
import type { Word } from '../../types/word'
import { extractAllLinks, rebuildLinksForWord, resolveIncomingLinks } from './links'

interface WordRow {
  id: number
  project_id: string
  word: string
  pronunciation: string | null
  part_of_speech: string | null
  cefr_level: string | null
  forms: string | null
  image: string | null
  audio: string | null
  meta: string | null
}

interface TranslationRow {
  word_id: number
  lang: string
  definitions: string | null
  main_examples: string | null
  usage_note: string | null
  comparisons: string | null
  collocations: string | null
  idioms: string | null
  related_forms: string | null
  word_history: string | null
  context_story: string | null
}

function parseJson<T>(s: string | null): T | undefined {
  if (s == null) return undefined
  try { return JSON.parse(s) as T } catch { return undefined }
}

function rowToWord(w: WordRow, t: TranslationRow | undefined): Word {
  const partOfSpeech = parseJson<string[]>(w.part_of_speech)
  const audio = parseJson<Word['audio']>(w.audio)
  const meta = parseJson<Word['meta']>(w.meta)
  const out: Word = {
    word: w.word,
    pronunciation: w.pronunciation ?? undefined,
    audio,
    partOfSpeech,
    cefrLevel: w.cefr_level ?? undefined,
    forms: w.forms,
    image: w.image ?? undefined,
    meta,
  }
  if (t) {
    out.definitions = parseJson(t.definitions)
    out.mainExamples = parseJson(t.main_examples)
    out.usageNote = t.usage_note
    out.comparisons = parseJson(t.comparisons)
    out.collocations = parseJson(t.collocations)
    out.idioms = parseJson(t.idioms)
    out.relatedForms = parseJson(t.related_forms)
    out.wordHistory = t.word_history
    out.contextStory = t.context_story
  }
  return stripUndefined(out)
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k]
  return obj
}

function jsonOrNull(v: unknown): string | null {
  if (v == null) return null
  return JSON.stringify(v)
}

export function listWords(db: Database.Database, projectId: string, lang: string): Word[] {
  const rows = db.prepare(`
    SELECT w.*, t.lang AS t_lang, t.definitions, t.main_examples, t.usage_note,
           t.comparisons, t.collocations, t.idioms, t.related_forms, t.word_history, t.context_story
    FROM words w
    LEFT JOIN word_translations t ON t.word_id = w.id AND t.lang = ?
    WHERE w.project_id = ?
    ORDER BY w.word COLLATE NOCASE
  `).all(lang, projectId) as any[]
  return rows.map(r => rowToWord(r as WordRow, r.t_lang ? r as TranslationRow : undefined))
}

export function getWord(db: Database.Database, projectId: string, word: string, lang: string): { id: number; word: Word } | null {
  const row = db.prepare(`
    SELECT w.*, t.lang AS t_lang, t.definitions, t.main_examples, t.usage_note,
           t.comparisons, t.collocations, t.idioms, t.related_forms, t.word_history, t.context_story
    FROM words w
    LEFT JOIN word_translations t ON t.word_id = w.id AND t.lang = ?
    WHERE w.project_id = ? AND w.word COLLATE NOCASE = ?
  `).get(lang, projectId, word) as any
  if (!row) return null
  return { id: row.id, word: rowToWord(row as WordRow, row.t_lang ? row as TranslationRow : undefined) }
}

export function getWordById(db: Database.Database, wordId: number, lang: string): Word | null {
  const row = db.prepare(`
    SELECT w.*, t.lang AS t_lang, t.definitions, t.main_examples, t.usage_note,
           t.comparisons, t.collocations, t.idioms, t.related_forms, t.word_history, t.context_story
    FROM words w
    LEFT JOIN word_translations t ON t.word_id = w.id AND t.lang = ?
    WHERE w.id = ?
  `).get(lang, wordId) as any
  if (!row) return null
  return rowToWord(row as WordRow, row.t_lang ? row as TranslationRow : undefined)
}

export function countWords(db: Database.Database, projectId: string): number {
  const r = db.prepare('SELECT COUNT(*) AS n FROM words WHERE project_id = ?').get(projectId) as { n: number }
  return r.n
}

export function countWordsByProject(db: Database.Database): Map<string, number> {
  const rows = db.prepare('SELECT project_id, COUNT(*) AS n FROM words GROUP BY project_id').all() as Array<{ project_id: string; n: number }>
  return new Map(rows.map(r => [r.project_id, r.n]))
}

export interface UpsertInput {
  projectId: string
  lang: string
  word: Word
}

export function upsertWord(db: Database.Database, input: UpsertInput): number {
  const { projectId, lang, word } = input
  if (!word.word) throw new Error('word.word is required')
  if (word.forms != null && typeof word.forms !== 'string') {
    throw new Error(`forms must be string or null, got ${typeof word.forms}`)
  }

  const tx = db.transaction(() => {
    // Upsert neutral row. If word exists, update neutral fields (assume caller passes
    // consistent neutral values across languages; mismatches would surface via diff tools).
    const existing = db.prepare(
      'SELECT id FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?'
    ).get(projectId, word.word) as { id: number } | undefined

    let wordId: number
    if (existing) {
      wordId = existing.id
      db.prepare(`
        UPDATE words SET
          word = ?,
          pronunciation = ?,
          part_of_speech = ?,
          cefr_level = ?,
          forms = ?,
          image = ?,
          audio = ?,
          meta = ?
        WHERE id = ?
      `).run(
        word.word,
        word.pronunciation ?? null,
        jsonOrNull(word.partOfSpeech),
        word.cefrLevel ?? null,
        word.forms ?? null,
        word.image ?? null,
        jsonOrNull(word.audio),
        jsonOrNull(word.meta),
        wordId,
      )
    } else {
      const r = db.prepare(`
        INSERT INTO words (project_id, word, pronunciation, part_of_speech, cefr_level, forms, image, audio, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        word.word,
        word.pronunciation ?? null,
        jsonOrNull(word.partOfSpeech),
        word.cefrLevel ?? null,
        word.forms ?? null,
        word.image ?? null,
        jsonOrNull(word.audio),
        jsonOrNull(word.meta),
      )
      wordId = Number(r.lastInsertRowid)
    }

    // Upsert translation
    db.prepare(`
      INSERT INTO word_translations
        (word_id, lang, definitions, main_examples, usage_note, comparisons, collocations, idioms, related_forms, word_history, context_story)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(word_id, lang) DO UPDATE SET
        definitions = excluded.definitions,
        main_examples = excluded.main_examples,
        usage_note = excluded.usage_note,
        comparisons = excluded.comparisons,
        collocations = excluded.collocations,
        idioms = excluded.idioms,
        related_forms = excluded.related_forms,
        word_history = excluded.word_history,
        context_story = excluded.context_story
    `).run(
      wordId,
      lang,
      jsonOrNull(word.definitions),
      jsonOrNull(word.mainExamples),
      word.usageNote ?? null,
      jsonOrNull(word.comparisons),
      jsonOrNull(word.collocations),
      jsonOrNull(word.idioms),
      jsonOrNull(word.relatedForms),
      word.wordHistory ?? null,
      word.contextStory ?? null,
    )

    // Rebuild outgoing links: union across both languages' current translations.
    const allTranslations = db.prepare(
      'SELECT lang FROM word_translations WHERE word_id = ?'
    ).all(wordId) as Array<{ lang: string }>

    const allLinks = []
    for (const { lang: tl } of allTranslations) {
      const tw = getWordById(db, wordId, tl)
      if (!tw) continue
      allLinks.push(...extractAllLinks(tw, tl))
    }
    rebuildLinksForWord(db, projectId, wordId, allLinks)

    // Resolve any incoming links that were pointing at this word's text
    resolveIncomingLinks(db, projectId, wordId, word.word.toLowerCase())

    return wordId
  })

  return tx()
}

export function deleteWord(db: Database.Database, projectId: string, word: string): boolean {
  const r = db.prepare('DELETE FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?').run(projectId, word)
  return r.changes > 0
}

export function listWordNames(db: Database.Database, projectId: string): string[] {
  const rows = db.prepare('SELECT word FROM words WHERE project_id = ? ORDER BY word COLLATE NOCASE').all(projectId) as Array<{ word: string }>
  return rows.map(r => r.word)
}

export function lookupWords(db: Database.Database, projectId: string, prefix: string, limit = 20): string[] {
  const rows = db.prepare(`
    SELECT word FROM words
    WHERE project_id = ? AND word LIKE ? COLLATE NOCASE
    ORDER BY word COLLATE NOCASE
    LIMIT ?
  `).all(projectId, `${prefix}%`, limit) as Array<{ word: string }>
  return rows.map(r => r.word)
}
