/**
 * Blink timing and sprite-sheet maths. The sheets themselves come from
 * scripts/encode-blinks.mjs; this only decides when a pair blinks and which
 * cell each moment of the blink shows, so it stays pure and the selftest can
 * drive it. Both eyes of a pair share one schedule — registry.ts steps them
 * from one clock.
 */

/** Rest between the end of one blink and the start of the next. The clips
 *  run 1–2.5s on their own, so this keeps a pair open most of the time. */
export const BLINK_MIN_INTERVAL_MS = 2500
export const BLINK_MAX_INTERVAL_MS = 8000
/** A pair whose blink came due this long ago was off screen at the time —
 *  it reschedules instead, or every pair scrolled into view would blink at
 *  once. */
export const BLINK_STALE_MS = 500

/** The first blink lands anywhere in one full interval, so pairs built in the
 *  same frame do not blink in unison. */
export function firstBlinkAt(now: number, rand: () => number = Math.random): number {
  return now + rand() * BLINK_MAX_INTERVAL_MS
}

export function nextBlinkAt(now: number, rand: () => number = Math.random): number {
  return now + BLINK_MIN_INTERVAL_MS + rand() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
}

/** Clip frame to show `elapsedMs` into a blink, or -1 once it has finished. */
export function blinkFrame(elapsedMs: number, fps: number, frames: number): number {
  const i = Math.floor((Math.max(0, elapsedMs) * fps) / 1000)
  return i < frames ? i : -1
}

/**
 * background-position that shows sheet cell `cell`, for a background sized to
 * cols×100% by rows×100%. A percentage position lines up that fraction of the
 * image with the same fraction of the box, hence the (n - 1) denominators.
 */
export function sheetPosition(cell: number, [cols, rows]: readonly [number, number]): string {
  const col = cell % cols
  const row = Math.floor(cell / cols)
  const x = cols > 1 ? (col / (cols - 1)) * 100 : 0
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0
  return `${+x.toFixed(4)}% ${+y.toFixed(4)}%`
}
