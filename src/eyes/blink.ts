/**
 * When a pair blinks. The clip itself (Assets/Blink, one per style) carries
 * the motion; this only decides the timing, so it stays a pure function the
 * selftest can drive. Both eyes of a pair share one schedule — registry.ts
 * starts their two videos in the same frame.
 */

/** Rest between the end of one blink and the start of the next. The clips
 *  run 1.3–2.5s on their own, so this keeps a pair open most of the time. */
export const BLINK_MIN_INTERVAL_MS = 2500
export const BLINK_MAX_INTERVAL_MS = 8000
/** A pair whose blink came due this long ago was off screen at the time —
 *  it reschedules instead, or every pair scrolled into view would blink at
 *  once. */
export const BLINK_STALE_MS = 500
/** Waited before retrying a blink whose clip has not buffered yet. */
export const BLINK_RETRY_MS = 400

/** The first blink lands anywhere in one full interval, so pairs built in the
 *  same frame do not blink in unison. */
export function firstBlinkAt(now: number, rand: () => number = Math.random): number {
  return now + rand() * BLINK_MAX_INTERVAL_MS
}

export function nextBlinkAt(now: number, rand: () => number = Math.random): number {
  return now + BLINK_MIN_INTERVAL_MS + rand() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
}

/**
 * Whether this browser keeps a WebM's alpha channel. Chrome and Firefox do;
 * Safari plays VP9 but has historically dropped the alpha, which would turn
 * every lid into a solid box over the eye. So: seek into the clip where the
 * lid is partly closed and look for both opaque and transparent pixels.
 * Anything short of that — no WebM support, a decode that never shows up —
 * counts as no, and the eyes just do not blink.
 */
export function probeAlpha(src: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const done = (ok: boolean) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    video.addEventListener('error', () => done(false), { once: true })
    // every clip starts and ends fully open; ~30% in, each one has the lid
    // partly drawn over a canvas whose corners stay empty
    video.addEventListener('loadedmetadata', () => (video.currentTime = video.duration * 0.3), { once: true })
    video.addEventListener(
      'seeked',
      () => {
        const w = video.videoWidth
        const h = video.videoHeight
        const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', {
          willReadFrequently: true,
        })
        if (!w || !h || !ctx) return done(false)
        ctx.drawImage(video, 0, 0)
        const data = ctx.getImageData(0, 0, w, h).data
        let opaque = false
        let clear = false
        for (let i = 3; i < data.length && !(opaque && clear); i += 4) {
          if (data[i]! > 200) opaque = true
          else if (data[i]! < 50) clear = true
        }
        done(opaque && clear)
      },
      { once: true },
    )
    video.src = src
  })
}
