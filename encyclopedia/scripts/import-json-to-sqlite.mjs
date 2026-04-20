#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

// Register ts-node-esm-alike loader? Not needed: we import compiled JS via esbuild-register?
// Simpler: do NOT import TS. Re-implement the repo write path inline using better-sqlite3 directly.
// This keeps the import script standalone.

import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(PROJECT_ROOT, 'public/data/projects')
const DB_PATH = path.join(PROJECT_ROOT, 'data/lexicon.db')
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'src/server/migrations')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL')

// Migrations
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
)`)
const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version))
for (const f of fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
  const v = parseInt(f.split('_')[0], 10)
  if (applied.has(v)) continue
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')
  db.transaction(() => {
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(v, new Date().toISOString())
  })()
  console.log(`[migrate] applied ${f}`)
}

// Link extraction (mirror of repo/links.ts — keep in sync)
const LINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g
function extractLinksFromText(text, field, lang) {
  if (!text || typeof text !== 'string') return []
  const out = []
  const seen = new Set()
  let m
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw || raw.includes(':')) continue
    const targetLc = raw.toLowerCase()
    const display = m[2] ? m[2].trim() : null
    const key = `${field}|${lang}|${targetLc}|${display ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ field, lang, targetLc, display })
  }
  return out
}
function extractAllLinks(word, lang) {
  const out = []
  if (word.definitions) for (const d of word.definitions) {
    out.push(...extractLinksFromText(d.text, 'definitions', lang))
    out.push(...extractLinksFromText(d.context, 'definitions', lang))
    if (d.examples) for (const ex of d.examples) out.push(...extractLinksFromText(ex, 'definitions', lang))
  }
  if (word.mainExamples) for (const ex of word.mainExamples) out.push(...extractLinksFromText(ex, 'mainExamples', lang))
  out.push(...extractLinksFromText(word.usageNote, 'usageNote', lang))
  if (word.comparisons) for (const c of word.comparisons) out.push(...extractLinksFromText(c.description, 'comparisons', lang))
  if (word.collocations) for (const c of word.collocations) {
    const t = typeof c === 'string' ? c : (c.text ?? c.phrase ?? '')
    out.push(...extractLinksFromText(t, 'collocations', lang))
  }
  if (word.idioms) for (const i of word.idioms) out.push(...extractLinksFromText(i.explanation, 'idioms', lang))
  if (word.relatedForms) for (const r of word.relatedForms) out.push(...extractLinksFromText(r.description, 'relatedForms', lang))
  out.push(...extractLinksFromText(word.wordHistory, 'wordHistory', lang))
  out.push(...extractLinksFromText(word.contextStory, 'contextStory', lang))
  return out
}

const jsonOrNull = v => (v == null ? null : JSON.stringify(v))

const NEUTRAL_FIELDS = ['pronunciation', 'partOfSpeech', 'cefrLevel', 'forms', 'image', 'audio', 'meta']

function mergeNeutral(ru, en) {
  const out = {}
  for (const f of NEUTRAL_FIELDS) {
    const rv = ru?.[f]
    const ev = en?.[f]
    if (JSON.stringify(rv ?? null) !== JSON.stringify(ev ?? null)) {
      // Prefer RU (primary), warn
      if (rv != null && ev != null) {
        console.warn(`  ⚠ neutral field "${f}" differs for "${(ru ?? en).word}" — using RU value`)
      }
      out[f] = rv != null ? rv : ev
    } else {
      out[f] = rv
    }
  }
  return out
}

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// Reset: wipe all existing data (script is idempotent restart)
db.exec('DELETE FROM word_links; DELETE FROM word_translations; DELETE FROM words; DELETE FROM projects;')

const insertProject = db.prepare(`INSERT INTO projects (id, name, title, subtitle, created_at) VALUES (?, ?, ?, ?, ?)`)
const insertWord = db.prepare(`
  INSERT INTO words (project_id, word, pronunciation, part_of_speech, cefr_level, forms, image, audio, meta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertTranslation = db.prepare(`
  INSERT INTO word_translations
    (word_id, lang, definitions, main_examples, usage_note, comparisons, collocations, idioms, related_forms, word_history, context_story)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const insertLink = db.prepare(`
  INSERT INTO word_links (project_id, source_word_id, lang, target_word_lc, target_word_id, field, display_text)
  VALUES (?, ?, ?, ?,
    (SELECT id FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?),
    ?, ?)
`)

let totalWords = 0
let totalProjects = 0
let totalLinks = 0
let totalBroken = 0

const projectDirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

const importProject = db.transaction((projectId) => {
  const projectDir = path.join(DATA_DIR, projectId)
  const metaFile = path.join(projectDir, 'project.json')
  if (!fs.existsSync(metaFile)) {
    console.warn(`[skip] ${projectId}: no project.json`)
    return 0
  }
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))

  const ru = readJsonSafe(path.join(projectDir, 'words.ru.json')) ?? []
  const en = readJsonSafe(path.join(projectDir, 'words.en.json')) ?? []

  const ruMap = new Map(ru.map(w => [w.word.toLowerCase(), w]))
  const enMap = new Map(en.map(w => [w.word.toLowerCase(), w]))
  const allKeys = new Set([...ruMap.keys(), ...enMap.keys()])

  insertProject.run(projectId, meta.name, meta.title ?? meta.name, meta.subtitle ?? '', meta.createdAt ?? new Date().toISOString())

  const wordIdByLc = new Map()

  for (const lc of allKeys) {
    const ruw = ruMap.get(lc)
    const enw = enMap.get(lc)
    const primary = ruw ?? enw
    const neutral = mergeNeutral(ruw, enw)

    const r = insertWord.run(
      projectId,
      primary.word,
      neutral.pronunciation ?? null,
      jsonOrNull(neutral.partOfSpeech),
      neutral.cefrLevel ?? null,
      neutral.forms ?? null,
      neutral.image ?? null,
      jsonOrNull(neutral.audio),
      jsonOrNull(neutral.meta),
    )
    const wordId = Number(r.lastInsertRowid)
    wordIdByLc.set(lc, wordId)
    totalWords++

    for (const [lang, src] of [['ru', ruw], ['en', enw]]) {
      if (!src) continue
      insertTranslation.run(
        wordId, lang,
        jsonOrNull(src.definitions),
        jsonOrNull(src.mainExamples),
        src.usageNote ?? null,
        jsonOrNull(src.comparisons),
        jsonOrNull(src.collocations),
        jsonOrNull(src.idioms),
        jsonOrNull(src.relatedForms),
        src.wordHistory ?? null,
        src.contextStory ?? null,
      )
    }
  }

  // Second pass: extract links (now that all words of the project exist, targets resolve)
  for (const lc of allKeys) {
    const wordId = wordIdByLc.get(lc)
    const ruw = ruMap.get(lc)
    const enw = enMap.get(lc)
    const links = []
    if (ruw) links.push(...extractAllLinks(ruw, 'ru'))
    if (enw) links.push(...extractAllLinks(enw, 'en'))
    for (const l of links) {
      insertLink.run(projectId, wordId, l.lang, l.targetLc, projectId, l.targetLc, l.field, l.display)
      totalLinks++
    }
  }

  const broken = db.prepare('SELECT COUNT(*) AS n FROM word_links WHERE project_id = ? AND target_word_id IS NULL').get(projectId).n
  totalBroken += broken

  totalProjects++
  return allKeys.size
})

for (const projectId of projectDirs) {
  const n = importProject(projectId)
  console.log(`[import] ${projectId}: ${n} words`)
}

console.log('')
console.log(`✓ Imported ${totalProjects} projects, ${totalWords} words, ${totalLinks} links (${totalBroken} broken)`)
db.close()
