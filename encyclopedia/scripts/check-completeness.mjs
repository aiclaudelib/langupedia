#!/usr/bin/env node
// Checks that every word in a project is "complete" — matches the fullness
// baseline of the `abortive` reference entry.
//
// Usage:
//   node scripts/check-completeness.mjs <project-id>
//
// Exit code: 0 if all complete, 1 otherwise.

import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data/lexicon.db')

const projectId = process.argv[2]
if (!projectId) {
  console.error('Usage: check-completeness.mjs <project-id>')
  process.exit(2)
}

const db = new Database(DB_PATH, { readonly: true })

const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
if (!project) {
  console.error(`Project not found: ${projectId}`)
  process.exit(2)
}

const words = db.prepare(`
  SELECT id, word, pronunciation, part_of_speech, cefr_level, image, audio
  FROM words
  WHERE project_id = ?
  ORDER BY word COLLATE NOCASE
`).all(projectId)

const transStmt = db.prepare(`
  SELECT lang, definitions, main_examples, usage_note, comparisons,
         collocations, related_forms, word_history, context_story
  FROM word_translations WHERE word_id = ?
`)

const isEmpty = (v) => {
  if (v === null || v === undefined) return true
  if (typeof v !== 'string') return false
  const s = v.trim()
  if (s === '' || s === 'null') return true
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p) && p.length === 0) return true
    if (p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === 0) return true
  } catch {}
  return false
}

const REQUIRED_WORD = ['pronunciation', 'part_of_speech', 'cefr_level', 'image', 'audio']
const REQUIRED_TRANS = [
  'definitions', 'main_examples', 'usage_note', 'comparisons',
  'collocations', 'related_forms', 'word_history', 'context_story'
]
const LANGS = ['ru', 'en']

const incomplete = []
const complete = []

for (const w of words) {
  const missing = { word: [], ru: [], en: [] }
  for (const f of REQUIRED_WORD) if (isEmpty(w[f])) missing.word.push(f)

  const trs = transStmt.all(w.id)
  const byLang = Object.fromEntries(trs.map(t => [t.lang, t]))
  for (const lang of LANGS) {
    const t = byLang[lang]
    if (!t) { missing[lang].push('(no translation row)'); continue }
    for (const f of REQUIRED_TRANS) if (isEmpty(t[f])) missing[lang].push(f)
  }

  const any = missing.word.length || missing.ru.length || missing.en.length
  if (any) incomplete.push({ word: w.word, missing })
  else complete.push(w.word)
}

console.log(`Project: ${projectId}`)
console.log(`Total: ${words.length}  Complete: ${complete.length}  Incomplete: ${incomplete.length}\n`)

if (complete.length) {
  console.log('=== COMPLETE ===')
  for (const w of complete) console.log(`  OK  ${w}`)
  console.log('')
}

if (incomplete.length) {
  console.log('=== INCOMPLETE ===')
  for (const r of incomplete) {
    console.log(`\n${r.word}:`)
    if (r.missing.word.length) console.log(`  word: ${r.missing.word.join(', ')}`)
    if (r.missing.ru.length)   console.log(`  ru:   ${r.missing.ru.join(', ')}`)
    if (r.missing.en.length)   console.log(`  en:   ${r.missing.en.join(', ')}`)
  }
  process.exit(1)
}
process.exit(0)
