#!/usr/bin/env node
// Node CLI for lexicon management backed by SQLite.
// Replaces legacy shell script. Usage:
//   node scripts/lexicon.mjs --project <id> [--lang <code>] <command> [args]
//
// Commands:
//   add                   Read JSON object from stdin, insert/update word in given lang
//   get <word>            Print word data (merged view, given lang)
//   list                  List all words (one per line)
//   count                 Print total word count
//   last [N]              Show last N added (by id)
//   set-field <word> <field> <value>
//                         Set a top-level word field (value parsed as JSON if valid)
//   backlinks <word>      Print words that link to this one
//   broken                Print broken links in the project
//   auto-linkify-compare  One-shot: wrap comparisons[].word matches in description with [[...]]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'data/lexicon.db')
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'src/server/migrations')

function usage() {
  console.error(`Usage: lexicon.mjs --project <id> [--lang <code>] <command> [args]

Options:
  --project <id>  Project id (required)
  --lang <code>   Language (default: ru)

Commands:
  add             Read JSON from stdin (must include .word), upsert
  get <word>      Print word entry
  list            List word names
  count           Total word count
  last [N]        Last N added words (default 2)
  set-field <word> <field> <value>
                  Set a top-level word field. If <value> is valid JSON,
                  it's parsed; otherwise treated as string.
  backlinks <word>
                  Words linking to <word>
  broken          Broken links report
  auto-linkify-compare
                  Wrap comparisons[].word matches inside description with [[...]]
`)
  process.exit(1)
}

const args = process.argv.slice(2)
let projectId = null
let lang = 'ru'

while (args.length) {
  if (args[0] === '--project') { projectId = args[1]; args.splice(0, 2); continue }
  if (args[0] === '--lang') { lang = args[1]; args.splice(0, 2); continue }
  break
}

if (!projectId) usage()
const cmd = args.shift()
if (!cmd) usage()

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Apply pending migrations
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`)
const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version))
for (const f of fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
  const v = parseInt(f.split('_')[0], 10)
  if (applied.has(v)) continue
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')
  db.transaction(() => {
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(v, new Date().toISOString())
  })()
}

if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) {
  console.error(`Error: project "${projectId}" not found`)
  process.exit(1)
}

// ---- Link extraction (mirror repo/links.ts) ----
const LINK_RE = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g
function extractLinksFromText(text, field, ln) {
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
    const key = `${field}|${ln}|${targetLc}|${display ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ field, lang: ln, targetLc, display })
  }
  return out
}
function extractAllLinks(word, ln) {
  const out = []
  if (word.definitions) for (const d of word.definitions) {
    out.push(...extractLinksFromText(d.text, 'definitions', ln))
    out.push(...extractLinksFromText(d.context, 'definitions', ln))
    if (d.examples) for (const ex of d.examples) out.push(...extractLinksFromText(ex, 'definitions', ln))
  }
  if (word.mainExamples) for (const ex of word.mainExamples) out.push(...extractLinksFromText(ex, 'mainExamples', ln))
  out.push(...extractLinksFromText(word.usageNote, 'usageNote', ln))
  if (word.comparisons) for (const c of word.comparisons) out.push(...extractLinksFromText(c.description, 'comparisons', ln))
  if (word.collocations) for (const c of word.collocations) {
    const t = typeof c === 'string' ? c : (c.text ?? c.phrase ?? '')
    out.push(...extractLinksFromText(t, 'collocations', ln))
  }
  if (word.idioms) for (const i of word.idioms) out.push(...extractLinksFromText(i.explanation, 'idioms', ln))
  if (word.relatedForms) for (const r of word.relatedForms) out.push(...extractLinksFromText(r.description, 'relatedForms', ln))
  out.push(...extractLinksFromText(word.wordHistory, 'wordHistory', ln))
  out.push(...extractLinksFromText(word.contextStory, 'contextStory', ln))
  return out
}

const jsonOrNull = v => (v == null ? null : JSON.stringify(v))
const parseJson = s => (s == null ? null : JSON.parse(s))

function composeWord(w, t) {
  if (!w) return null
  return {
    word: w.word,
    pronunciation: w.pronunciation,
    audio: parseJson(w.audio),
    partOfSpeech: parseJson(w.part_of_speech),
    cefrLevel: w.cefr_level,
    forms: w.forms,
    image: w.image,
    definitions: t ? parseJson(t.definitions) : null,
    mainExamples: t ? parseJson(t.main_examples) : null,
    usageNote: t ? t.usage_note : null,
    comparisons: t ? parseJson(t.comparisons) : null,
    collocations: t ? parseJson(t.collocations) : null,
    idioms: t ? parseJson(t.idioms) : null,
    relatedForms: t ? parseJson(t.related_forms) : null,
    wordHistory: t ? t.word_history : null,
    contextStory: t ? t.context_story : null,
    meta: parseJson(w.meta),
  }
}

function getRow(word) {
  return db.prepare('SELECT * FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?').get(projectId, word)
}

function rebuildLinks(wordId) {
  db.prepare('DELETE FROM word_links WHERE source_word_id = ?').run(wordId)
  const langs = db.prepare('SELECT lang FROM word_translations WHERE word_id = ?').all(wordId).map(r => r.lang)
  const insert = db.prepare(`
    INSERT INTO word_links (project_id, source_word_id, lang, target_word_lc, target_word_id, field, display_text)
    VALUES (?, ?, ?, ?,
      (SELECT id FROM words WHERE project_id = ? AND word COLLATE NOCASE = ?),
      ?, ?)
  `)
  for (const ln of langs) {
    const w = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId)
    const t = db.prepare('SELECT * FROM word_translations WHERE word_id = ? AND lang = ?').get(wordId, ln)
    const composed = composeWord(w, t)
    const links = extractAllLinks(composed, ln)
    for (const l of links) insert.run(projectId, wordId, l.lang, l.targetLc, projectId, l.targetLc, l.field, l.display)
  }
}

function upsertWord(input) {
  if (!input.word) throw new Error('word field required')
  if (input.forms != null && typeof input.forms !== 'string') {
    throw new Error(`forms must be string or null, got ${typeof input.forms}`)
  }
  const today = new Date().toISOString().slice(0, 10)
  const meta = {
    timesAccessed: input.meta?.timesAccessed ?? 0,
    lastReviewed: input.meta?.lastReviewed ?? null,
    srsLevel: input.meta?.srsLevel ?? 0,
    dateAdded: input.meta?.dateAdded ?? today,
  }

  return db.transaction(() => {
    const existing = getRow(input.word)
    let wordId
    if (existing) {
      wordId = existing.id
      db.prepare(`UPDATE words SET word=?, pronunciation=?, part_of_speech=?, cefr_level=?, forms=?, image=?, audio=?, meta=? WHERE id = ?`).run(
        input.word,
        input.pronunciation ?? null,
        jsonOrNull(input.partOfSpeech),
        input.cefrLevel ?? null,
        input.forms ?? null,
        input.image ?? null,
        jsonOrNull(input.audio),
        jsonOrNull(meta),
        wordId,
      )
    } else {
      const r = db.prepare(`INSERT INTO words (project_id, word, pronunciation, part_of_speech, cefr_level, forms, image, audio, meta) VALUES (?,?,?,?,?,?,?,?,?)`).run(
        projectId,
        input.word,
        input.pronunciation ?? null,
        jsonOrNull(input.partOfSpeech),
        input.cefrLevel ?? null,
        input.forms ?? null,
        input.image ?? null,
        jsonOrNull(input.audio),
        jsonOrNull(meta),
      )
      wordId = Number(r.lastInsertRowid)
    }
    db.prepare(`INSERT INTO word_translations (word_id, lang, definitions, main_examples, usage_note, comparisons, collocations, idioms, related_forms, word_history, context_story)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(word_id, lang) DO UPDATE SET
        definitions=excluded.definitions, main_examples=excluded.main_examples, usage_note=excluded.usage_note,
        comparisons=excluded.comparisons, collocations=excluded.collocations, idioms=excluded.idioms,
        related_forms=excluded.related_forms, word_history=excluded.word_history, context_story=excluded.context_story`).run(
      wordId, lang,
      jsonOrNull(input.definitions),
      jsonOrNull(input.mainExamples),
      input.usageNote ?? null,
      jsonOrNull(input.comparisons),
      jsonOrNull(input.collocations),
      jsonOrNull(input.idioms),
      jsonOrNull(input.relatedForms),
      input.wordHistory ?? null,
      input.contextStory ?? null,
    )
    rebuildLinks(wordId)
    db.prepare(`UPDATE word_links SET target_word_id = ? WHERE project_id = ? AND target_word_lc = ? AND target_word_id IS NULL`).run(wordId, projectId, input.word.toLowerCase())
    return wordId
  })()
}

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', c => data += c)
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

switch (cmd) {
  case 'add': {
    const raw = await readStdin()
    if (!raw.trim()) { console.error('Error: empty stdin'); process.exit(1) }
    let input
    try { input = JSON.parse(raw) } catch (e) { console.error('Error: invalid JSON:', e.message); process.exit(1) }
    const id = upsertWord(input)
    const count = db.prepare('SELECT COUNT(*) AS n FROM words WHERE project_id = ?').get(projectId).n
    console.log(`Upserted "${input.word}" (id=${id}, ${count} words total)`)
    break
  }
  case 'get': {
    const word = args[0]
    if (!word) { console.error('Error: get requires a word'); process.exit(1) }
    const w = getRow(word)
    if (!w) { console.error(`Word not found: ${word}`); process.exit(1) }
    const t = db.prepare('SELECT * FROM word_translations WHERE word_id = ? AND lang = ?').get(w.id, lang)
    console.log(JSON.stringify(composeWord(w, t), null, 2))
    break
  }
  case 'list': {
    const rows = db.prepare('SELECT word FROM words WHERE project_id = ? ORDER BY word COLLATE NOCASE').all(projectId)
    for (const r of rows) console.log(r.word)
    break
  }
  case 'count': {
    const r = db.prepare('SELECT COUNT(*) AS n FROM words WHERE project_id = ?').get(projectId)
    console.log(r.n)
    break
  }
  case 'last': {
    const n = parseInt(args[0] ?? '2', 10) || 2
    const rows = db.prepare('SELECT word FROM words WHERE project_id = ? ORDER BY id DESC LIMIT ?').all(projectId, n)
    for (const r of rows.reverse()) console.log(r.word)
    break
  }
  case 'set-field': {
    const [word, field, value] = args
    if (!word || !field || value === undefined) { console.error('Usage: set-field <word> <field> <value>'); process.exit(1) }
    const w = getRow(word)
    if (!w) { console.error(`Word not found: ${word}`); process.exit(1) }
    const fieldMap = {
      pronunciation: 'pronunciation',
      partOfSpeech:  'part_of_speech',
      cefrLevel:     'cefr_level',
      forms:         'forms',
      image:         'image',
      audio:         'audio',
      meta:          'meta',
    }
    const col = fieldMap[field]
    if (!col) { console.error(`Unsupported field: ${field} (neutral only)`); process.exit(1) }
    let stored
    try { stored = JSON.stringify(JSON.parse(value)) } catch { stored = value }
    const isJsonCol = ['part_of_speech', 'audio', 'meta'].includes(col)
    db.prepare(`UPDATE words SET ${col} = ? WHERE id = ?`).run(isJsonCol ? stored : value, w.id)
    console.log(`Set "${field}" on "${word}"`)
    break
  }
  case 'backlinks': {
    const word = args[0]
    if (!word) { console.error('Error: backlinks requires a word'); process.exit(1) }
    const w = getRow(word)
    if (!w) { console.error(`Word not found: ${word}`); process.exit(1) }
    const rows = db.prepare(`
      SELECT w.word AS word, GROUP_CONCAT(DISTINCT wl.field) AS fields
      FROM word_links wl JOIN words w ON w.id = wl.source_word_id
      WHERE wl.target_word_id = ? GROUP BY wl.source_word_id
      ORDER BY w.word COLLATE NOCASE
    `).all(w.id)
    for (const r of rows) console.log(`${r.word}\t${r.fields}`)
    break
  }
  case 'broken': {
    const rows = db.prepare(`
      SELECT wl.target_word_lc AS target, w.word AS source, wl.field, wl.lang
      FROM word_links wl JOIN words w ON w.id = wl.source_word_id
      WHERE wl.project_id = ? AND wl.target_word_id IS NULL
      ORDER BY wl.target_word_lc, w.word
    `).all(projectId)
    for (const r of rows) console.log(`${r.target}\t← ${r.source} (${r.lang}.${r.field})`)
    break
  }
  case 'auto-linkify-compare': {
    // For each word's translations, check comparisons[].word — if matches an existing project word,
    // wrap first whole-word occurrence of that target inside comparisons[i].description with [[target|match]].
    const targets = db.prepare('SELECT word FROM words WHERE project_id = ?').all(projectId).map(r => r.word)
    const targetSet = new Set(targets.map(t => t.toLowerCase()))

    const wordRows = db.prepare('SELECT id, word FROM words WHERE project_id = ?').all(projectId)
    let changed = 0
    for (const { id: wid, word: srcWord } of wordRows) {
      const srcLc = srcWord.toLowerCase()
      for (const ln of ['ru', 'en']) {
        const t = db.prepare('SELECT comparisons FROM word_translations WHERE word_id = ? AND lang = ?').get(wid, ln)
        if (!t?.comparisons) continue
        const cmp = JSON.parse(t.comparisons)
        if (!Array.isArray(cmp)) continue
        let modified = false
        for (const c of cmp) {
          if (!c?.word || !c?.description) continue
          if (c.description.includes('[[')) continue
          const targetLc = c.word.toLowerCase()
          if (targetLc === srcLc) continue // skip self-reference
          if (!targetSet.has(targetLc)) continue
          const re = new RegExp(`\\b(${c.word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})\\b`, 'i')
          const m = c.description.match(re)
          if (!m) continue
          const rendered = m[1] === c.word ? `[[${c.word}]]` : `[[${c.word}|${m[1]}]]`
          c.description = c.description.replace(re, rendered)
          modified = true
        }
        if (modified) {
          db.prepare('UPDATE word_translations SET comparisons = ? WHERE word_id = ? AND lang = ?').run(JSON.stringify(cmp), wid, ln)
          rebuildLinks(wid)
          changed++
        }
      }
    }
    console.log(`Modified ${changed} translation rows`)
    break
  }
  default:
    console.error(`Unknown command: ${cmd}`)
    usage()
}

db.close()
