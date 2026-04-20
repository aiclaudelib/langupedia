#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(PROJECT_ROOT, 'public/data/projects')
const DB_PATH = path.join(PROJECT_ROOT, 'data/lexicon.db')

if (!fs.existsSync(DB_PATH)) {
  console.error(`[export] DB not found at ${DB_PATH}`)
  process.exit(1)
}

const db = new Database(DB_PATH, { readonly: true })

const parseJson = s => (s == null ? null : JSON.parse(s))

function composeWord(w, t) {
  // Preserve field order matching existing JSON layout
  const out = {}
  out.word = w.word
  if (w.pronunciation != null) out.pronunciation = w.pronunciation
  const audio = parseJson(w.audio)
  if (audio) out.audio = audio
  const pos = parseJson(w.part_of_speech)
  if (pos) out.partOfSpeech = pos
  if (w.cefr_level != null) out.cefrLevel = w.cefr_level
  if (w.forms !== null) out.forms = w.forms
  if (w.image != null) out.image = w.image
  if (t) {
    const defs = parseJson(t.definitions)
    if (defs) out.definitions = defs
    const mex = parseJson(t.main_examples)
    if (mex) out.mainExamples = mex
    if (t.usage_note !== null) out.usageNote = t.usage_note
    const cmp = parseJson(t.comparisons)
    if (cmp) out.comparisons = cmp
    const col = parseJson(t.collocations)
    if (col) out.collocations = col
    const idi = parseJson(t.idioms)
    if (idi) out.idioms = idi
    const rfs = parseJson(t.related_forms)
    if (rfs) out.relatedForms = rfs
    if (t.word_history !== null) out.wordHistory = t.word_history
    if (t.context_story !== null) out.contextStory = t.context_story
  }
  const meta = parseJson(w.meta)
  if (meta) out.meta = meta
  return out
}

const projects = db.prepare('SELECT id, name, title, subtitle, created_at FROM projects ORDER BY created_at').all()
const indexEntries = []

for (const p of projects) {
  const projectDir = path.join(DATA_DIR, p.id)
  fs.mkdirSync(projectDir, { recursive: true })

  const metaFile = path.join(projectDir, 'project.json')
  const meta = {
    name: p.name,
    title: p.title,
    subtitle: p.subtitle,
    createdAt: p.created_at,
  }
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n')

  const words = db.prepare(`
    SELECT id, word, pronunciation, part_of_speech, cefr_level, forms, image, audio, meta
    FROM words WHERE project_id = ? ORDER BY word COLLATE NOCASE
  `).all(p.id)

  for (const lang of ['ru', 'en']) {
    const arr = []
    for (const w of words) {
      const t = db.prepare(
        'SELECT * FROM word_translations WHERE word_id = ? AND lang = ?'
      ).get(w.id, lang)
      if (!t) continue
      arr.push(composeWord(w, t))
    }
    const file = path.join(projectDir, `words.${lang}.json`)
    fs.writeFileSync(file, JSON.stringify(arr, null, 2) + '\n')
  }

  const wordCount = db.prepare('SELECT COUNT(*) AS n FROM words WHERE project_id = ?').get(p.id).n
  indexEntries.push({
    id: p.id,
    name: p.name,
    title: p.title,
    subtitle: p.subtitle,
    wordCount,
    createdAt: p.created_at,
  })
  console.log(`[export] ${p.id}: ${wordCount} words`)
}

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(indexEntries, null, 2) + '\n')
console.log(`[export] index.json (${indexEntries.length} projects)`)
db.close()
