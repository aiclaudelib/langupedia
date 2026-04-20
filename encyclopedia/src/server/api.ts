import type { IncomingMessage, ServerResponse } from 'node:http'
import { getDb } from './db'
import * as projectsRepo from './repo/projects'
import * as wordsRepo from './repo/words'
import * as linksRepo from './repo/links'

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function error(res: ServerResponse, message: string, status = 400) {
  json(res, { error: message }, status)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const pathname = url.pathname
  if (!pathname.startsWith('/api/')) return false

  const db = getDb()

  // GET /api/projects
  if (pathname === '/api/projects' && req.method === 'GET') {
    json(res, projectsRepo.listProjects(db))
    return true
  }

  // POST /api/projects
  if (pathname === '/api/projects' && req.method === 'POST') {
    const body = await readBody(req)
    let data: { name?: string; title?: string; subtitle?: string }
    try { data = JSON.parse(body) } catch { error(res, 'Invalid JSON'); return true }
    if (!data.name) { error(res, 'Name is required'); return true }
    const id = slugify(data.name)
    if (projectsRepo.projectExists(db, id)) { error(res, 'Project already exists', 409); return true }
    const project = projectsRepo.createProject(db, {
      id, name: data.name, title: data.title, subtitle: data.subtitle,
    })
    json(res, project, 201)
    return true
  }

  // Path matchers
  const wordsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/words$/)
  const wordLookupMatch = pathname.match(/^\/api\/projects\/([^/]+)\/words\/lookup$/)
  const backlinksMatch = pathname.match(/^\/api\/projects\/([^/]+)\/words\/([^/]+)\/backlinks$/)
  const brokenMatch = pathname.match(/^\/api\/projects\/([^/]+)\/links\/broken$/)
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)

  // GET /api/projects/:id/words/lookup?q=...
  if (wordLookupMatch && req.method === 'GET') {
    const id = wordLookupMatch[1]
    if (!projectsRepo.projectExists(db, id)) { error(res, 'Not found', 404); return true }
    const q = url.searchParams.get('q') ?? ''
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 100)
    json(res, wordsRepo.lookupWords(db, id, q, limit))
    return true
  }

  // GET /api/projects/:id/words/:slug/backlinks
  if (backlinksMatch && req.method === 'GET') {
    const id = backlinksMatch[1]
    const slug = decodeURIComponent(backlinksMatch[2])
    const found = wordsRepo.getWord(db, id, slug, 'en')
    if (!found) { error(res, 'Not found', 404); return true }
    json(res, linksRepo.getBacklinks(db, found.id))
    return true
  }

  // GET /api/projects/:id/links/broken
  if (brokenMatch && req.method === 'GET') {
    const id = brokenMatch[1]
    if (!projectsRepo.projectExists(db, id)) { error(res, 'Not found', 404); return true }
    json(res, linksRepo.getBrokenLinks(db, id))
    return true
  }

  // GET /api/projects/:id/words?lang=xx
  if (wordsMatch && req.method === 'GET') {
    const id = wordsMatch[1]
    if (!projectsRepo.projectExists(db, id)) { error(res, 'Not found', 404); return true }
    const lang = url.searchParams.get('lang') || 'en'
    json(res, wordsRepo.listWords(db, id, lang))
    return true
  }

  // GET /api/projects/:id
  if (projectMatch && req.method === 'GET') {
    const id = projectMatch[1]
    const project = projectsRepo.getProject(db, id)
    if (!project) { error(res, 'Not found', 404); return true }
    json(res, project)
    return true
  }

  // PUT /api/projects/:id
  if (projectMatch && req.method === 'PUT') {
    const id = projectMatch[1]
    const body = await readBody(req)
    let data: { name?: string; title?: string; subtitle?: string }
    try { data = JSON.parse(body) } catch { error(res, 'Invalid JSON'); return true }
    const updated = projectsRepo.updateProject(db, id, data)
    if (!updated) { error(res, 'Not found', 404); return true }
    json(res, updated)
    return true
  }

  // DELETE /api/projects/:id
  if (projectMatch && req.method === 'DELETE') {
    const id = projectMatch[1]
    if (!projectsRepo.deleteProject(db, id)) { error(res, 'Not found', 404); return true }
    json(res, { ok: true })
    return true
  }

  error(res, 'Not found', 404)
  return true
}
