import { STYLES } from '../data/styles'
import { BLINK_STALE_MS, blinkFrame, firstBlinkAt, nextBlinkAt, sheetPosition } from './blink'
import { gazeOffset } from './gaze'
import { initialWander, stepWander, type WanderState } from './wander'

/** Distance at which a target deflects the pupil fully. */
const FALLOFF_PX = 400
/** Per-frame approach to the target. Phase 3 detects faces at ~15Hz; this is
 *  what turns those steps into smooth motion. */
const SMOOTHING = 0.05
/** Skip a style write when the pupil barely moved. */
const EPSILON = 5e-4
/** Start tracking slightly before an eye scrolls into view. */
const PRELOAD_MARGIN = '100px'

type Eye = {
  eye: HTMLElement
  ball: HTMLElement
}

/**
 * One .eye-pair — the unit that looks and blinks. Both eyes of a pair share
 * one target, one gaze direction and one blink, so they always move as a
 * pair; Mike's group just has a single eye in it.
 */
type Pair = {
  el: HTMLElement
  slug: string
  eyes: Eye[]
  /** Blink sprite sheets, one per eye (a lid over it, or the pupil itself);
   *  empty for styles that never blink. */
  sheets: HTMLElement[]
  /** background-position for each frame of the blink, precomputed per style. */
  frames: readonly string[]
  fps: number
  /** Index of the drifting column this pair rides, or -1 when the layout is
   *  a plain scrolling list. */
  col: number
  /** cos/sin of the pair's rotation, for converting into its local frame. */
  cos: number
  sin: number
  /** Midpoint of the eyes' sockets in document space, refreshed by
   *  rebuild(). The gaze is aimed from here rather than from each eye, so
   *  both eyes get the same offset and look the same way. */
  x: number
  y: number
  /** Eased copy of whichever target this pair is following. */
  aim: { x: number; y: number }
  bx: number
  by: number
  wander: WanderState
  blinkAt: number
  /** performance.now() the running blink started at; 0 when not blinking. */
  blinkStart: number
  /** Frame currently shown, so an unchanged frame is not rewritten. */
  shown: string
}

export type Registry = ReturnType<typeof createRegistry>

/**
 * Drives every pupil, crossfading between two sources by `gain`: with nothing
 * found, each eye pair wanders its own glance (wander.ts); once a target is
 * set, every pair converges on that one shared point instead — or, with
 * several faces, on the face nearest it across the screen.
 *
 * Also plays the blinks: each pair on its own random timer (blink.ts), both
 * of its eyes stepped through their sprite sheet from the same clock.
 *
 * Positions are cached in document space and corrected by live scroll offsets
 * each frame, so scrolling never triggers a layout read. `scroller` is the
 * element that scrolls on mobile; on tablet and desktop the page scrolls and
 * its own scroll offsets stay zero, so both are simply added.
 */
export function createRegistry(scroller: HTMLElement) {
  const pairs: Pair[] = []
  const byElement = new Map<Element, Pair>()
  const travel = new Map<string, [number, number]>()
  /** Ellipse centre per style, before mirroring. Seeded from STYLES, which
   *  already folds in eye-tuning.ts; the debug panel overwrites it live. */
  const sockets = new Map<string, [number, number]>()
  const visible = new Set<Pair>()
  let target = { x: 0, y: 0 }
  /** Every detected face in screen space; each pair follows the one nearest
   *  it horizontally. Empty means "just follow `target`". */
  let targets: number[][] = []
  let smooth = { x: 0, y: 0 }
  let falloff = FALLOFF_PX
  /** Live per-column drift offsets, when the desktop layout is running. */
  let columnOffsets: readonly number[] = []
  // scales every offset: eases the pupils back to rest when the face is lost
  let gain = 0
  let wantGain = 0
  let stale = true
  let raf = 0
  /** Frame positions per style, built once from its sheet's timeline. */
  const frameCache = new Map<string, string[]>()

  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        const p = byElement.get(r.target)
        if (!p) continue
        if (r.isIntersecting) visible.add(p)
        else visible.delete(p)
      }
    },
    { rootMargin: PRELOAD_MARGIN },
  )

  // the feed's box changes on resize and when Phase 4 appends cards
  const ro = new ResizeObserver(() => {
    stale = true
  })
  ro.observe(scroller)

  function addAll(root: ParentNode) {
    const now = performance.now()
    for (const el of root.querySelectorAll<HTMLElement>('.eye-pair')) {
      if (byElement.has(el)) continue
      const eyes: Eye[] = []
      let slug = ''
      for (const eye of el.querySelectorAll<HTMLElement>('.eye')) {
        const ball = eye.querySelector<HTMLElement>('.eye__ball')
        slug = eye.dataset.style ?? ''
        if (!STYLES[slug] || !ball) throw new Error('registry: malformed eye element')
        eyes.push({ eye, ball })
      }
      const style = STYLES[slug]
      if (!style) throw new Error('registry: empty eye pair')
      if (!travel.has(slug)) travel.set(slug, [style.travel[0] / 100, style.travel[1] / 100])
      if (!sockets.has(slug)) sockets.set(slug, [style.socket[0], style.socket[1]])

      const sheets = [...el.querySelectorAll<HTMLElement>('.eye__sheet')]
      const sheet = style.blink
      let frames = frameCache.get(slug) ?? []
      if (sheet && !frameCache.has(slug)) {
        frames = sheet.timeline.map((cell) => sheetPosition(cell, sheet.grid))
        frameCache.set(slug, frames)
      }

      const rad = (Number(eyes[0]!.eye.dataset.tilt ?? 0) * Math.PI) / 180
      const col = Number(el.closest<HTMLElement>('.feed__col')?.dataset.col ?? -1)
      // prettier-ignore
      const pair: Pair = {
        el, slug, eyes, sheets, frames, fps: sheet?.fps ?? 0, col,
        cos: Math.cos(rad), sin: Math.sin(rad),
        x: 0, y: 0, aim: { x: 0, y: 0 }, bx: 0, by: 0,
        wander: initialWander(now), blinkAt: firstBlinkAt(now), blinkStart: 0, shown: frames[0] ?? '',
      }
      pairs.push(pair)
      byElement.set(el, pair)
      io.observe(el)
    }
    stale = true
  }

  function rebuild() {
    const ox = window.scrollX + scroller.scrollLeft
    const oy = window.scrollY + scroller.scrollTop
    for (const p of pairs) {
      const [tunedX, tunedY] = sockets.get(p.slug)!
      let sx = 0
      let sy = 0
      for (const { eye } of p.eyes) {
        const flip = eye.classList.contains('eye--flip')
        const socketX = flip ? 100 - tunedX : tunedX
        const r = eye.getBoundingClientRect()
        // A rotated element's rect is its bounding box, so only the centre is
        // trustworthy; offsetWidth/Height give the unrotated layout size.
        const localX = (socketX / 100 - 0.5) * eye.offsetWidth
        const localY = (tunedY / 100 - 0.5) * eye.offsetHeight
        sx += r.left + r.width / 2 + localX * p.cos - localY * p.sin
        sy += r.top + r.height / 2 + localX * p.sin + localY * p.cos
      }
      // The rect includes the pair's own lean towards its gaze (--x/--y in
      // eye.css, in the pair's rotated frame) — take it back out, or the
      // cached socket would shift every time the pair looked somewhere.
      const w = p.eyes[0]!.eye.offsetWidth
      const leanX = w * (p.bx * p.cos - p.by * p.sin)
      const leanY = w * (p.bx * p.sin + p.by * p.cos)
      // Likewise the column's current drift: the cache holds an
      // untransformed position that frame() re-offsets.
      const drift = p.col >= 0 ? (columnOffsets[p.col] ?? 0) : 0
      p.x = sx / p.eyes.length - leanX + ox
      p.y = sy / p.eyes.length - leanY + oy + drift
    }
    stale = false
  }

  function showFrame(p: Pair, position: string) {
    if (position === p.shown) return
    p.shown = position
    for (const el of p.sheets) el.style.backgroundPosition = position
  }

  function stepBlink(p: Pair, now: number) {
    if (p.blinkStart) {
      // A pair that scrolled away mid-blink lands past the end on its return,
      // and simply settles back on the first frame.
      const i = blinkFrame(now - p.blinkStart, p.fps, p.frames.length)
      if (i >= 0) return showFrame(p, p.frames[i]!)
      showFrame(p, p.frames[0]!)
      p.blinkStart = 0
      p.blinkAt = nextBlinkAt(now)
      return
    }
    if (now < p.blinkAt) return
    if (now - p.blinkAt > BLINK_STALE_MS) p.blinkAt = nextBlinkAt(now)
    else p.blinkStart = now
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    const now = performance.now()
    smooth.x += (target.x - smooth.x) * SMOOTHING
    smooth.y += (target.y - smooth.y) * SMOOTHING
    gain += (wantGain - gain) * SMOOTHING
    if (stale) rebuild()

    const ox = window.scrollX + scroller.scrollLeft
    const oy = window.scrollY + scroller.scrollTop
    for (const p of visible) {
      p.wander = stepWander(p.wander, now)
      if (p.sheets.length) stepBlink(p, now)

      const drift = p.col >= 0 ? (columnOffsets[p.col] ?? 0) : 0
      const px = p.x - ox
      const py = p.y - oy - drift

      // with several faces in view, each pair follows the one nearest it
      // across the screen; otherwise the single shared target
      let goalX = smooth.x
      let goalY = smooth.y
      let nearest = Infinity
      for (const t of targets) {
        const d = Math.abs(px - t[0]!)
        if (d >= nearest) continue
        nearest = d
        goalX = t[0]!
        goalY = t[1]!
      }
      p.aim.x += (goalX - p.aim.x) * SMOOTHING
      p.aim.y += (goalY - p.aim.y) * SMOOTHING

      const [tx, ty] = travel.get(p.slug)!
      const vx = p.aim.x - px
      const vy = p.aim.y - py
      // into the pair's own frame: the pupil translates inside a rotated box,
      // so a tilted pair still aims at the target rather than beside it
      const [trackedX, trackedY] = gazeOffset(
        vx * p.cos + vy * p.sin,
        vy * p.cos - vx * p.sin,
        tx,
        ty,
        falloff,
      )
      // Idle-glance point is already a fraction of this eye's own travel
      // ellipse (see wander.ts), not a real point to aim at, so it skips the
      // rotation compensation above — a uniformly random direction stays
      // uniformly random after a fixed rotation, so there is nothing to gain
      // from compensating it.
      const wanderX = p.wander.x * tx
      const wanderY = p.wander.y * ty
      // gain is the crossfade: 0 = every pair glances on its own, 1 = every
      // pair looks at the same found target. Both operands sit inside the
      // travel ellipse already, and the ellipse is convex, so the blend
      // can't ever push the pupil past either one's own bound.
      const bx = wanderX * (1 - gain) + trackedX * gain
      const by = wanderY * (1 - gain) + trackedY * gain
      if (Math.abs(bx - p.bx) < EPSILON && Math.abs(by - p.by) < EPSILON) continue
      p.bx = bx
      p.by = by
      // 5dp keeps the written value from rounding above the travel radius
      const sbx = bx.toFixed(5)
      const sby = by.toFixed(5)
      for (const { ball } of p.eyes) {
        ball.style.setProperty('--bx', sbx)
        ball.style.setProperty('--by', sby)
      }
      // the pair leans after its pupils (see eye.css)
      p.el.style.setProperty('--x', sbx)
      p.el.style.setProperty('--y', sby)
    }
  }

  return {
    addAll,
    /** Screen coordinates of whatever the eyes should look at. */
    setTarget(x: number, y: number) {
      target = { x, y }
      wantGain = 1
    },
    /** Every face in view, in screen coordinates; each pair follows the one
     *  nearest it horizontally. */
    setTargets(list: number[][]) {
      targets = list
      wantGain = 1
    },
    /** Jump instead of easing — for a target that reappeared somewhere new. */
    snapTo(x: number, y: number) {
      target = { x, y }
      smooth = { x, y }
      wantGain = 1
    },
    /** Nothing to look at: each pair eases off the shared target and back to
     *  wandering its own glance (see wander.ts) instead of sitting still. */
    releaseTarget() {
      wantGain = 0
    },
    isEngaged: () => wantGain === 1,
    /** Smoothed point the pupils are actually aiming at, and how hard. */
    getGaze: () => ({ x: smooth.x, y: smooth.y, gain }),
    getFalloff: () => falloff,
    /** Distance at which a target pulls the pupil all the way over. */
    setFalloff(px: number) {
      falloff = Math.max(1, px)
    },
    /** Recompute cached positions; call after moving cards around. */
    invalidate() {
      stale = true
    },
    /** Live offsets of the drifting desktop columns, read every frame. Pass an
     *  empty array when the layout is a plain scrolling list. */
    useColumnOffsets(next: readonly number[]) {
      columnOffsets = next
      stale = true
    },
    getTravel: (slug: string) => travel.get(slug),
    /** Live tuning from the debug panel. Values are fractions of the eye box. */
    setTravel(slug: string, value: [number, number]) {
      travel.set(slug, value)
    },
    getSocket: (slug: string) => sockets.get(slug),
    /** Ellipse centre in percent of the eye box, before mirroring. */
    setSocket(slug: string, value: [number, number]) {
      sockets.set(slug, value)
      stale = true
    },
    styleSlugs: () => [...travel.keys()],
    start() {
      if (!raf) frame()
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    },
  }
}
