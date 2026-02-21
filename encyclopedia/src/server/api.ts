import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const DATA_DIR = path.resolve(process.cwd(), 'public/data/projects')

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

function countWords(projectDir: string): number {
  const enFile = path.join(projectDir, 'words.en.json')
  if (!fs.existsSync(enFile)) return 0
  try {
    const data = JSON.parse(fs.readFileSync(enFile, 'utf-8'))
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const pathname = url.pathname

  if (!pathname.startsWith('/api/')) return false

  // GET /api/projects
  if (pathname === '/api/projects' && req.method === 'GET') {
    if (!fs.existsSync(DATA_DIR)) {
      json(res, [])
      return true
    }
    const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
    const projects = dirs.map(d => {
      const projectDir = path.join(DATA_DIR, d.name)
      const metaFile = path.join(projectDir, 'project.json')
      if (!fs.existsSync(metaFile)) return null
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
        return {
          id: d.name,
          name: meta.name,
          title: meta.title,
          subtitle: meta.subtitle,
          wordCount: countWords(projectDir),
          createdAt: meta.createdAt,
        }
      } catch {
        return null
      }
    }).filter(Boolean)
    json(res, projects)
    return true
  }

  // POST /api/projects
  if (pathname === '/api/projects' && req.method === 'POST') {
    const body = await readBody(req)
    let data: { name?: string; title?: string; subtitle?: string }
    try {
      data = JSON.parse(body)
    } catch {
      error(res, 'Invalid JSON')
      return true
    }
    if (!data.name) {
      error(res, 'Name is required')
      return true
    }
    const id = slugify(data.name)
    const projectDir = path.join(DATA_DIR, id)
    if (fs.existsSync(projectDir)) {
      error(res, 'Project already exists', 409)
      return true
    }
    fs.mkdirSync(projectDir, { recursive: true })
    fs.mkdirSync(path.join(projectDir, 'images', 'words'), { recursive: true })
    const meta = {
      name: data.name,
      title: data.title || data.name,
      subtitle: data.subtitle || '',
      createdAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(meta, null, 2))
    fs.writeFileSync(path.join(projectDir, 'words.ru.json'), '[]')
    fs.writeFileSync(path.join(projectDir, 'words.en.json'), '[]')
    json(res, { id, ...meta, wordCount: 0 }, 201)
    return true
  }

  // Routes with :id
  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)
  const wordsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/words$/)

  // GET /api/projects/:id/words?lang=xx
  if (wordsMatch && req.method === 'GET') {
    const id = wordsMatch[1]
    const lang = url.searchParams.get('lang') || 'en'
    const filePath = path.join(DATA_DIR, id, `words.${lang}.json`)
    if (!fs.existsSync(filePath)) {
      error(res, 'Not found', 404)
      return true
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(content)
    return true
  }

  // GET /api/projects/:id
  if (projectMatch && req.method === 'GET') {
    const id = projectMatch[1]
    const metaFile = path.join(DATA_DIR, id, 'project.json')
    if (!fs.existsSync(metaFile)) {
      error(res, 'Not found', 404)
      return true
    }
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
    const projectDir = path.join(DATA_DIR, id)
    json(res, { id, ...meta, wordCount: countWords(projectDir) })
    return true
  }

  // PUT /api/projects/:id
  if (projectMatch && req.method === 'PUT') {
    const id = projectMatch[1]
    const metaFile = path.join(DATA_DIR, id, 'project.json')
    if (!fs.existsSync(metaFile)) {
      error(res, 'Not found', 404)
      return true
    }
    const body = await readBody(req)
    let data: { name?: string; title?: string; subtitle?: string }
    try {
      data = JSON.parse(body)
    } catch {
      error(res, 'Invalid JSON')
      return true
    }
    const existing = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
    const updated = {
      ...existing,
      name: data.name ?? existing.name,
      title: data.title ?? existing.title,
      subtitle: data.subtitle ?? existing.subtitle,
    }
    fs.writeFileSync(metaFile, JSON.stringify(updated, null, 2))
    const projectDir = path.join(DATA_DIR, id)
    json(res, { id, ...updated, wordCount: countWords(projectDir) })
    return true
  }

  // DELETE /api/projects/:id
  if (projectMatch && req.method === 'DELETE') {
    const id = projectMatch[1]
    const projectDir = path.join(DATA_DIR, id)
    if (!fs.existsSync(projectDir)) {
      error(res, 'Not found', 404)
      return true
    }
    fs.rmSync(projectDir, { recursive: true, force: true })
    json(res, { ok: true })
    return true
  }

  error(res, 'Not found', 404)
  return true
}
