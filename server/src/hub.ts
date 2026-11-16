import type { WebSocket } from 'ws'
import type { StudioEvent } from '@rpa/shared'

export class Hub {
  private clients = new Set<WebSocket>()

  add(socket: WebSocket): void {
    this.clients.add(socket)
    socket.on('close', () => this.clients.delete(socket))
  }

  broadcast(event: StudioEvent): void {
    const payload = JSON.stringify(event)
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(payload)
    }
  }
}
