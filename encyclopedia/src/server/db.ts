import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = path.resolve(process.cwd(), 'data/lexicon.db')
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations')

let instance: Database.Database | null = null

export function getDb(): Database.Database {
  if (instance) return instance

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)
  instance = db
  return db
}

function runMigrations(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version),
  )

  if (!fs.existsSync(MIGRATIONS_DIR)) return

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.*\.sql$/.test(f))
    .sort()

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10)
    if (applied.has(version)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    const tx = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(version, new Date().toISOString())
    })
    tx()
    console.log(`[db] applied migration ${file}`)
  }
}

export function closeDb() {
  if (instance) {
    instance.close()
    instance = null
  }
}
