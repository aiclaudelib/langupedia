import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { setupDb } from './setupDb'
import { extractAllLinks, extractLinksFromText, getBacklinks, getBrokenLinks } from '../links'
import { createProject } from '../projects'
import { upsertWord, deleteWord } from '../words'
import type { Word } from '../../../types/word'

// ---------------------------------------------------------------------------
// extractLinksFromText — pure function, no DB
// ---------------------------------------------------------------------------

describe('extractLinksFromText', () => {
  it('returns [] for empty string', () => {
    expect(extractLinksFromText('', 'definitions', 'en')).toEqual([])
  })

  it('returns [] for null input', () => {
    expect(extractLinksFromText(null, 'definitions', 'en')).toEqual([])
  })

  it('returns [] for undefined input', () => {
    expect(extractLinksFromText(undefined, 'definitions', 'en')).toEqual([])
  })

  it('returns [] for plain text with no markup', () => {
    expect(extractLinksFromText('just regular words here', 'definitions', 'en')).toEqual([])
  })

  it('extracts a simple [[target]] link', () => {
    const out = extractLinksFromText('see [[target]] for more', 'definitions', 'en')
    expect(out).toEqual([
      { field: 'definitions', lang: 'en', targetLc: 'target', display: null },
    ])
  })

  it('preserves the field/lang arguments on the extracted link', () => {
    const out = extractLinksFromText('[[foo]]', 'idioms', 'ru')
    expect(out[0]).toMatchObject({ field: 'idioms', lang: 'ru' })
  })

  it('lowercases the target in [[Target|shown]] and stores display', () => {
    const out = extractLinksFromText('[[Target|shown]]', 'definitions', 'en')
    expect(out).toEqual([
      { field: 'definitions', lang: 'en', targetLc: 'target', display: 'shown' },
    ])
  })

  it('extracts multiple links from one string', () => {
    const out = extractLinksFromText('[[a]] and [[b]] and [[c]]', 'definitions', 'en')
    expect(out.map((l) => l.targetLc)).toEqual(['a', 'b', 'c'])
  })

  it('deduplicates repeated [[x]] [[x]] into a single entry', () => {
    const out = extractLinksFromText('[[x]] foo [[x]]', 'definitions', 'en')
    expect(out).toHaveLength(1)
    expect(out[0].targetLc).toBe('x')
  })

  it('skips cross-project syntax [[project:word]]', () => {
    const out = extractLinksFromText('[[tainted-grail:abhor]]', 'definitions', 'en')
    expect(out).toEqual([])
  })

  it('trims whitespace around the target', () => {
    const out = extractLinksFromText('[[  spaced  ]]', 'definitions', 'en')
    expect(out).toHaveLength(1)
    expect(out[0].targetLc).toBe('spaced')
  })

  it('does not match across newlines inside the brackets', () => {
    const out = extractLinksFromText('[[foo\nbar]]', 'definitions', 'en')
    expect(out).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// extractAllLinks — walks Word fields
// ---------------------------------------------------------------------------

describe('extractAllLinks', () => {
  it('finds links across every supported Word field and tags field/lang correctly', () => {
    const w: Word = {
      word: 'host',
      definitions: [
        { sense: 1, text: 'see [[def-link]]', examples: ['example [[ex-link]]'] },
      ],
      mainExamples: ['top [[main-ex]]'],
      comparisons: [{ word: 'guest', description: 'compare to [[cmp]]' }],
      idioms: [{ phrase: 'play host', explanation: 'means [[idiom-link]]' }],
      relatedForms: [{ word: 'hosted', description: 'past of [[rf-link]]' }],
      wordHistory: 'from [[wh-link]] origin',
      contextStory: 'once upon a [[cs-link]]',
      collocations: ['coll [[coll-str]]', { text: 'coll [[coll-text]]' }, { phrase: 'coll [[coll-phrase]]' }],
    }

    const out = extractAllLinks(w, 'en')
    const tuples = out.map((l) => ({ field: l.field, lang: l.lang, targetLc: l.targetLc }))

    expect(tuples).toEqual(
      expect.arrayContaining([
        { field: 'definitions', lang: 'en', targetLc: 'def-link' },
        { field: 'definitions', lang: 'en', targetLc: 'ex-link' },
        { field: 'mainExamples', lang: 'en', targetLc: 'main-ex' },
        { field: 'comparisons', lang: 'en', targetLc: 'cmp' },
        { field: 'idioms', lang: 'en', targetLc: 'idiom-link' },
        { field: 'relatedForms', lang: 'en', targetLc: 'rf-link' },
        { field: 'wordHistory', lang: 'en', targetLc: 'wh-link' },
        { field: 'contextStory', lang: 'en', targetLc: 'cs-link' },
        { field: 'collocations', lang: 'en', targetLc: 'coll-str' },
        { field: 'collocations', lang: 'en', targetLc: 'coll-text' },
        { field: 'collocations', lang: 'en', targetLc: 'coll-phrase' },
      ]),
    )
  })

  it('returns an empty list when the Word has no link markup anywhere', () => {
    const w: Word = { word: 'plain', definitions: [{ sense: 1, text: 'no links here' }] }
    expect(extractAllLinks(w, 'en')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// upsertWord → link materialization (integration, in-memory DB)
// ---------------------------------------------------------------------------

describe('upsertWord link materialization', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupDb()
    createProject(db, { id: 'p1', name: 'p1' })
  })

  afterEach(() => {
    db.close()
  })

  function linkRowsForSource(wordId: number) {
    return db
      .prepare(
        `SELECT source_word_id, target_word_id, target_word_lc, field, lang, display_text
         FROM word_links WHERE source_word_id = ?
         ORDER BY target_word_lc, lang, field`,
      )
      .all(wordId) as Array<{
      source_word_id: number
      target_word_id: number | null
      target_word_lc: string
      field: string
      lang: string
      display_text: string | null
    }>
  }

  it('resolves link target_word_id when the target already exists', () => {
    const abhorId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'abhor' } })
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[abhor]]' }] },
    })
    const rows = linkRowsForSource(aId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source_word_id: aId,
      target_word_id: abhorId,
      target_word_lc: 'abhor',
      field: 'definitions',
    })
  })

  it('stores target_word_id = NULL for a forward reference', () => {
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })
    const rows = linkRowsForSource(aId)
    expect(rows).toHaveLength(1)
    expect(rows[0].target_word_id).toBeNull()
    expect(rows[0].target_word_lc).toBe('b')
  })

  it('resolves forward references when the target is later added', () => {
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })
    expect(linkRowsForSource(aId)[0].target_word_id).toBeNull()

    const bId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    expect(linkRowsForSource(aId)[0].target_word_id).toBe(bId)
  })

  it('rebuilds links on update: old targets removed, new targets added', () => {
    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'c' } })

    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })
    expect(linkRowsForSource(aId).map((r) => r.target_word_lc)).toEqual(['b'])

    upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[c]]' }] },
    })
    const after = linkRowsForSource(aId)
    expect(after.map((r) => r.target_word_lc)).toEqual(['c'])
  })

  it('deletes outgoing links when the source word is deleted (ON DELETE CASCADE)', () => {
    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })
    expect(linkRowsForSource(aId)).toHaveLength(1)

    deleteWord(db, 'p1', 'a')
    const rows = db.prepare('SELECT * FROM word_links WHERE source_word_id = ?').all(aId)
    expect(rows).toEqual([])
  })

  it('nulls out incoming target_word_id when the target is deleted (ON DELETE SET NULL)', () => {
    const bId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })
    expect(linkRowsForSource(aId)[0].target_word_id).toBe(bId)

    deleteWord(db, 'p1', 'b')
    const rows = linkRowsForSource(aId)
    expect(rows).toHaveLength(1)
    expect(rows[0].target_word_id).toBeNull()
    expect(rows[0].target_word_lc).toBe('b')
  })

  it('extracts links from both language translations and tags them by lang', () => {
    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'x' } })
    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'y' } })

    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'ru',
      word: { word: 'a', definitions: [{ sense: 1, text: 'см [[x]]' }] },
    })
    upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[y]]' }] },
    })

    const rows = linkRowsForSource(aId)
    const byTarget = Object.fromEntries(rows.map((r) => [r.target_word_lc, r.lang]))
    expect(byTarget).toEqual({ x: 'ru', y: 'en' })
  })
})

// ---------------------------------------------------------------------------
// getBacklinks / getBrokenLinks
// ---------------------------------------------------------------------------

describe('getBacklinks', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupDb()
    createProject(db, { id: 'p1', name: 'p1' })
  })

  afterEach(() => {
    db.close()
  })

  it('returns sources that link to a word with the fields used', () => {
    const bId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'A', definitions: [{ sense: 1, text: 'see [[b]]' }] },
    })

    const links = getBacklinks(db, bId)
    expect(links).toEqual([{ word: 'A', fields: ['definitions'] }])
  })

  it('returns [] when a word has no incoming links', () => {
    const bId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'b' } })
    expect(getBacklinks(db, bId)).toEqual([])
  })
})

describe('getBrokenLinks', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupDb()
    createProject(db, { id: 'p1', name: 'p1' })
  })

  afterEach(() => {
    db.close()
  })

  it('reports broken links with target/source/field/lang columns', () => {
    upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[ghost]]' }] },
    })
    const broken = getBrokenLinks(db, 'p1') as Array<{
      target: string; source: string; field: string; lang: string
    }>
    expect(broken).toHaveLength(1)
    expect(broken[0]).toMatchObject({ target: 'ghost', source: 'a', field: 'definitions', lang: 'en' })
  })

  it('shrinks once the target is added', () => {
    upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[ghost]]' }] },
    })
    expect(getBrokenLinks(db, 'p1')).toHaveLength(1)

    upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'ghost' } })
    expect(getBrokenLinks(db, 'p1')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Edge behavior
// ---------------------------------------------------------------------------

describe('edge behavior', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupDb()
    createProject(db, { id: 'p1', name: 'p1' })
  })

  afterEach(() => {
    db.close()
  })

  it('[[x|x]] stores display equal to the target (kept, not null)', () => {
    const out = extractLinksFromText('[[x|x]]', 'definitions', 'en')
    // Implementation keeps the raw display text whatever it is; assert current behavior.
    expect(out).toEqual([
      { field: 'definitions', lang: 'en', targetLc: 'x', display: 'x' },
    ])
  })

  it('resolves [[Abhor]] to the lowercase-stored word "abhor" (case-insensitive)', () => {
    const abhorId = upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'abhor' } })
    const aId = upsertWord(db, {
      projectId: 'p1',
      lang: 'en',
      word: { word: 'a', definitions: [{ sense: 1, text: 'see [[Abhor]]' }] },
    })
    const row = db
      .prepare('SELECT target_word_id, target_word_lc FROM word_links WHERE source_word_id = ?')
      .get(aId) as { target_word_id: number | null; target_word_lc: string }
    expect(row.target_word_id).toBe(abhorId)
    expect(row.target_word_lc).toBe('abhor')
  })
})
