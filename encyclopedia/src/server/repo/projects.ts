import type Database from 'better-sqlite3'
import { countWordsByProject } from './words'

export interface ProjectRow {
  id: string
  name: string
  title: string
  subtitle: string
  createdAt: string
  wordCount: number
}

export function listProjects(db: Database.Database): ProjectRow[] {
  const rows = db.prepare(`
    SELECT id, name, title, subtitle, created_at AS createdAt
    FROM projects
    ORDER BY created_at
  `).all() as Array<Omit<ProjectRow, 'wordCount'>>
  const counts = countWordsByProject(db)
  return rows.map(r => ({ ...r, wordCount: counts.get(r.id) ?? 0 }))
}

export function getProject(db: Database.Database, id: string): ProjectRow | null {
  const r = db.prepare(`
    SELECT id, name, title, subtitle, created_at AS createdAt
    FROM projects WHERE id = ?
  `).get(id) as Omit<ProjectRow, 'wordCount'> | undefined
  if (!r) return null
  const n = db.prepare('SELECT COUNT(*) AS n FROM words WHERE project_id = ?').get(id) as { n: number }
  return { ...r, wordCount: n.n }
}

export interface ProjectInput {
  id: string
  name: string
  title?: string
  subtitle?: string
}

export function createProject(db: Database.Database, input: ProjectInput): ProjectRow {
  const createdAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO projects (id, name, title, subtitle, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.id, input.name, input.title ?? input.name, input.subtitle ?? '', createdAt)
  return {
    id: input.id,
    name: input.name,
    title: input.title ?? input.name,
    subtitle: input.subtitle ?? '',
    createdAt,
    wordCount: 0,
  }
}

export function updateProject(db: Database.Database, id: string, patch: Partial<Pick<ProjectRow, 'name' | 'title' | 'subtitle'>>): ProjectRow | null {
  const existing = getProject(db, id)
  if (!existing) return null
  db.prepare(`
    UPDATE projects SET name = ?, title = ?, subtitle = ? WHERE id = ?
  `).run(
    patch.name ?? existing.name,
    patch.title ?? existing.title,
    patch.subtitle ?? existing.subtitle,
    id,
  )
  return getProject(db, id)
}

export function deleteProject(db: Database.Database, id: string): boolean {
  const r = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return r.changes > 0
}

export function projectExists(db: Database.Database, id: string): boolean {
  const r = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)
  return r != null
}
