import { STYLES } from '../data/styles'
import { gazeOffset } from './gaze'
import { initialWander, stepWander, type WanderState } from './wander'

/** Distance at which a target deflects the pupil fully. */
const FALLOFF_PX = 400
/** Per-frame approach to the target. Phase 3 detects faces at ~15Hz; this is
 *  what turns those steps into smooth motion. */
const SMOOTHING = 0.15
/** Skip a style write when the pupil barely moved. */
const EPSILON = 5e-4
/** Start tracking slightly before an eye scrolls into view. */
const PRELOAD_MARGIN = '100px'

type Entry = {
  eye: HTMLElement
  ball: HTMLElement
  pair: Element
  slug: string
  /** Socket position in document space, refreshed by rebuild(). */
  x: number
  y: number
  /** cos/sin of the eye's rotation, for converting into its local frame. */
  cos: number
  sin: number
  /** Index of the drifting column this eye rides, or -1 when the layout is
   *  a plain scrolling list. */
  col: number
  bx: number
  by: number
}

export type Registry = ReturnType<typeof createRegistry>

/**
 * Drives every pupil, crossfading between two sources by `gain`: with nothing
 * found, each eye pair wanders its own glance (wander.ts); once a target is
 * set, every pair converges on that one shared point instead.
 *
 * Positions are cached in document space and corrected by live scroll offsets
 * each frame, so scrolling never triggers a layout read. `scroller` is the
 * element that scrolls on mobile; on tablet and desktop the page scrolls and
 * its own scroll offsets stay zero, so both are simply added.
 */
export function createRegistry(scroller: HTMLElement) {
  const entries: Entry[] = []
  const travel = new Map<string, [number, number]>()
  /** Ellipse centre per style, before mirroring. Seeded from STYLES, which
   *  already folds in eye-tuning.ts; the debug panel overwrites it live. */
  const sockets = new Map<string, [number, number]>()
  const visible = new Set<Element>()
  /** One independent idle-glance state per eye group (both eyes of a pair
   *  share it, so they glance together — just not together with anyone else's
   *  pair). Keyed by the .eye-pair element itself. */
  const wander = new Map<Element, WanderState>()
  let target = { x: 0, y: 0 }
  let smooth = { x: 0, y: 0 }
  let falloff = FALLOFF_PX
  /** Live per-column drift offsets, when the desktop layout is running. */
  let columnOffsets: readonly number[] = []
  // scales every offset: eases the pupils back to rest when the face is lost
  let gain = 0
  let wantGain = 0
  let stale = true
  let raf = 0

  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        if (r.isIntersecting) visible.add(r.target)
        else visible.delete(r.target)
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
    for (const pair of root.querySelectorAll('.eye-pair')) {
      if (!wander.has(pair)) wander.set(pair, initialWander(performance.now()))
      for (const eye of pair.querySelectorAll<HTMLElement>('.eye')) {
        const slug = eye.dataset.style
        const style = slug ? STYLES[slug] : undefined
        const ball = eye.querySelector<HTMLElement>('.eye__ball')
        if (!slug || !style || !ball) throw new Error('registry: malformed eye element')
        if (!travel.has(slug)) travel.set(slug, [style.travel[0] / 100, style.travel[1] / 100])
        if (!sockets.has(slug)) sockets.set(slug, [style.socket[0], style.socket[1]])
        const rad = (Number(eye.dataset.tilt ?? 0) * Math.PI) / 180
        const col = Number(eye.closest<HTMLElement>('.feed__col')?.dataset.col ?? -1)
        // prettier-ignore
        entries.push({
          eye, ball, pair, slug, col,
          x: 0, y: 0, cos: Math.cos(rad), sin: Math.sin(rad), bx: 0, by: 0,
        })
      }
      io.observe(pair)
    }
    stale = true
  }

  function rebuild() {
    const ox = window.scrollX + scroller.scrollLeft
    const oy = window.scrollY + scroller.scrollTop
    for (const e of entries) {
      const [tunedX, tunedY] = sockets.get(e.slug)!
      const flip = e.eye.classList.contains('eye--flip')
      const socketX = flip ? 100 - tunedX : tunedX
      const r = e.eye.getBoundingClientRect()
      // A rotated element's rect is its bounding box, so only the centre is
      // trustworthy; offsetWidth/Height give the unrotated layout size.
      const localX = (socketX / 100 - 0.5) * e.eye.offsetWidth
      const localY = (tunedY / 100 - 0.5) * e.eye.offsetHeight
      // gaze originates at the socket, which is off-centre in several styles.
      // The rect already includes the column's current drift, so add it back:
      // the cache holds an untransformed position that frame() re-offsets.
      const drift = e.col >= 0 ? (columnOffsets[e.col] ?? 0) : 0
      e.x = r.left + r.width / 2 + localX * e.cos - localY * e.sin + ox
      e.y = r.top + r.height / 2 + localX * e.sin + localY * e.cos + oy + drift
    }
    stale = false
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    const now = performance.now()
    smooth.x += (target.x - smooth.x) * SMOOTHING
    smooth.y += (target.y - smooth.y) * SMOOTHING
    gain += (wantGain - gain) * SMOOTHING
    if (stale) rebuild()

    // one idle-glance step per visible pair — `visible` is a Set, so a pair
    // with two eyes still only advances once
    for (const pair of visible) {
      const w = wander.get(pair)
      if (w) wander.set(pair, stepWander(w, now))
    }

    const ox = window.scrollX + scroller.scrollLeft
    const oy = window.scrollY + scroller.scrollTop
    for (const e of entries) {
      if (!visible.has(e.pair)) continue
      const [tx, ty] = travel.get(e.slug)!
      const drift = e.col >= 0 ? (columnOffsets[e.col] ?? 0) : 0
      const vx = smooth.x - (e.x - ox)
      const vy = smooth.y - (e.y - oy - drift)
      // into the eye's own frame: the pupil translates inside a rotated box,
      // so a tilted eye still aims at the target rather than beside it
      const [trackedX, trackedY] = gazeOffset(
        vx * e.cos + vy * e.sin,
        vy * e.cos - vx * e.sin,
        tx,
        ty,
        falloff,
      )
      // Idle-glance point is already a fraction of this eye's own travel
      // ellipse (see wander.ts), not a real point to aim at, so it skips the
      // rotation compensation above — a uniformly random direction stays
      // uniformly random after a fixed rotation, so there is nothing to gain
      // from compensating it.
      const w = wander.get(e.pair)!
      const wanderX = w.x * tx
      const wanderY = w.y * ty
      // gain is the crossfade: 0 = every pair glances on its own, 1 = every
      // pair looks at the same found target. Both operands sit inside the
      // travel ellipse already, and the ellipse is convex, so the blend
      // can't ever push the pupil past either one's own bound.
      const bx = wanderX * (1 - gain) + trackedX * gain
      const by = wanderY * (1 - gain) + trackedY * gain
      if (Math.abs(bx - e.bx) < EPSILON && Math.abs(by - e.by) < EPSILON) continue
      e.bx = bx
      e.by = by
      // 5dp keeps the written value from rounding above the travel radius
      e.ball.style.setProperty('--bx', bx.toFixed(5))
      e.ball.style.setProperty('--by', by.toFixed(5))
    }
  }

  return {
    addAll,
    /** Screen coordinates of whatever the eyes should look at. */
    setTarget(x: number, y: number) {
      target = { x, y }
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
