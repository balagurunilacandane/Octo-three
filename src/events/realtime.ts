import type { EventBus } from './eventBus'
import type { WorldEvent } from './types'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

/**
 * Connect a backend event stream (WebSocket or Server-Sent Events) to a world's bus.
 * Each message must be a JSON WorldEvent (or an array of them).
 * Returns a disconnect function. Reconnects with exponential backoff.
 */
export function connectRealtime(
  kind: 'websocket' | 'sse',
  url: string,
  bus: EventBus,
  onStatus: (s: ConnectionStatus) => void = () => {},
): () => void {
  let closed = false
  let retry = 0
  let ws: WebSocket | null = null
  let es: EventSource | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const handle = (raw: string) => {
    try {
      const data = JSON.parse(raw) as WorldEvent | WorldEvent[]
      for (const e of Array.isArray(data) ? data : [data]) {
        if (e && typeof e === 'object' && typeof (e as WorldEvent).event === 'string') bus.emit(e)
      }
    } catch {
      // Ignore malformed frames; a production build would report these.
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    const delay = Math.min(30000, 1000 * 2 ** retry++)
    timer = setTimeout(open, delay)
  }

  function open() {
    if (closed || !url) return
    onStatus('connecting')
    try {
      if (kind === 'websocket') {
        ws = new WebSocket(url)
        ws.onopen = () => {
          retry = 0
          onStatus('open')
        }
        ws.onmessage = (m) => handle(String(m.data))
        ws.onerror = () => onStatus('error')
        ws.onclose = () => {
          onStatus('closed')
          scheduleReconnect()
        }
      } else {
        es = new EventSource(url)
        es.onopen = () => {
          retry = 0
          onStatus('open')
        }
        es.onmessage = (m) => handle(m.data)
        es.onerror = () => {
          onStatus('error')
          es?.close()
          scheduleReconnect()
        }
      }
    } catch {
      onStatus('error')
      scheduleReconnect()
    }
  }

  open()
  return () => {
    closed = true
    clearTimeout(timer)
    ws?.close()
    es?.close()
    onStatus('idle')
  }
}
