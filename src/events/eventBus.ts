import type { WorldEvent } from './types'

type Listener = (e: WorldEvent) => void

/** Tiny synchronous pub/sub. One bus per mounted world, so worlds never mix events. */
export class EventBus {
  private listeners = new Set<Listener>()

  emit(e: WorldEvent) {
    for (const l of [...this.listeners]) l(e)
  }

  on(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  /** Resolve once an event matching `pred` is emitted. */
  waitFor<T extends WorldEvent>(pred: (e: WorldEvent) => e is T, signal?: AbortSignal): Promise<T>
  waitFor(pred: (e: WorldEvent) => boolean, signal?: AbortSignal): Promise<WorldEvent>
  waitFor(pred: (e: WorldEvent) => boolean, signal?: AbortSignal): Promise<WorldEvent> {
    return new Promise((resolve, reject) => {
      const off = this.on((e) => {
        if (pred(e)) {
          off()
          resolve(e)
        }
      })
      signal?.addEventListener('abort', () => {
        off()
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  }
}
