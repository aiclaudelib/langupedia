import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), 'public/data/projects')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), '[]')
  console.log('Created empty index.json (no projects found)')
  process.exit(0)
}

const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())

const projects = dirs.map(d => {
  const projectDir = path.join(DATA_DIR, d.name)
  const metaFile = path.join(projectDir, 'project.json')
  if (!fs.existsSync(metaFile)) return null
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
    const enFile = path.join(projectDir, 'words.en.json')
    let wordCount = 0
    if (fs.existsSync(enFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(enFile, 'utf-8'))
        wordCount = Array.isArray(data) ? data.length : 0
      } catch { /* ignore */ }
    }
    return {
      id: d.name,
      name: meta.name,
      title: meta.title,
      subtitle: meta.subtitle,
      wordCount,
      createdAt: meta.createdAt,
    }
  } catch {
    return null
  }
}).filter(Boolean)

const outPath = path.join(DATA_DIR, 'index.json')
fs.writeFileSync(outPath, JSON.stringify(projects, null, 2))
console.log(`Generated ${outPath} (${projects.length} projects)`)
