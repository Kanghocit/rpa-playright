import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { createApp } from './app.js'
import { Hub } from './hub.js'
import { FileStore } from './store.js'
import { Studio } from './studio.js'

export function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
}

export async function startServer(port = Number(process.env.PORT || 3789)) {
  const root = projectRoot()
  const store = new FileStore(root)
  await store.init()
  const hub = new Hub()
  const studio = new Studio(store, hub, root)
  const app = createApp(store, studio)
  const server = http.createServer(app)
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0]
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => hub.add(ws))
    } else {
      socket.destroy()
    }
  })
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const actual = typeof address === 'object' && address ? address.port : port
  return { server, port: actual, store, studio }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  startServer()
    .then(({ port }) => {
      console.log(`Playwright RPA API listening on http://127.0.0.1:${port}`)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
