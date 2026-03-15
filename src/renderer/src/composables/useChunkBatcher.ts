/**
 * RAF-based chunk batcher for SSE streams.
 * Accumulates incoming chunks and flushes once per animation frame,
 * reducing downstream processing from ~50/s to ~60/s (1x per frame).
 */
export function createChunkBatcher(onFlush: (accumulated: string) => void) {
  let buffer = ''
  let rafId: number | null = null

  function scheduleFlush() {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (buffer.length > 0) {
        const data = buffer
        buffer = ''
        onFlush(data)
      }
    })
  }

  function push(chunk: string) {
    buffer += chunk
    scheduleFlush()
  }

  function flush() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (buffer.length > 0) {
      const data = buffer
      buffer = ''
      onFlush(data)
    }
  }

  function destroy() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    buffer = ''
  }

  return { push, flush, destroy }
}
