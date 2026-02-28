import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const LEXICON_SH = resolve(ROOT, 'lexicon.sh')
const PORT = 4174

const queue = []
let isProcessing = false

function enqueue(job) {
  return new Promise(resolve => {
    queue.push({ ...job, resolve })
    drainQueue()
  })
}

async function drainQueue() {
  if (isProcessing) return
  isProcessing = true
  while (queue.length > 0) {
    const job = queue.shift()
    const result = spawnSync('bash', [LEXICON_SH, '--project', job.project, '--lang', job.lang, 'add'], {
      input: JSON.stringify(job.word),
      cwd: ROOT,
      encoding: 'utf8',
    })
    job.resolve(
      result.status === 0
        ? { ok: true, message: result.stdout.trim() }
        : { ok: false, message: result.stderr.trim() || result.stdout.trim() }
    )
  }
  isProcessing = false
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) }
      catch (e) { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, queueLength: queue.length, isProcessing })
  }

  if (req.method === 'POST' && req.url === '/api/words') {
    let body
    try {
      body = await readBody(req)
    } catch (e) {
      return send(res, 400, { ok: false, message: e.message })
    }

    const { project, lang, word } = body
    if (!project || !lang || !word) {
      return send(res, 400, { ok: false, message: 'Missing required fields: project, lang, word' })
    }

    const result = await enqueue({ project, lang, word })
    return send(res, result.ok ? 200 : 500, result)
  }

  send(res, 404, { ok: false, message: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`push-word service listening on http://localhost:${PORT}`)
})
