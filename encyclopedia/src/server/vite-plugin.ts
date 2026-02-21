import type { Plugin, ViteDevServer, PreviewServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApiRequest } from './api'

export function apiPlugin(): Plugin {
  function applyMiddleware(server: ViteDevServer | PreviewServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      handleApiRequest(req, res)
        .then((handled) => {
          if (!handled) next()
        })
        .catch((err) => {
          console.error('API error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        })
    })
  }

  return {
    name: 'lexicon-api',
    configureServer(server) {
      applyMiddleware(server)
    },
    configurePreviewServer(server) {
      applyMiddleware(server)
    },
  }
}
