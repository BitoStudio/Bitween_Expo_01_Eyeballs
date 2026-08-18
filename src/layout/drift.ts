import { periodHeight } from './columns'
import { columnOffset } from './wrap'

/**
 * Fraction of the remaining distance covered each frame — an exponential
 * ease-out. Lower is heavier and glides further; higher stops sooner.
 */
const LERP = 0.075
/** Scales a wheel notch. */
const WHEEL_MULTIPLIER = 1.15
/**
 * Scales bare mouse movement, which drives the feed exactly like the wheel --
 * no button, no gesture, just moving the pointer. 1 means a pixel of mouse
 * travel is a pixel of feed travel; lower it to make the room calmer.
 */
const MOVE_MULTIPLIER = 1
/** How much of the release velocity carries on as a fling, in frames. */
const FLING = 12


export type Drift = {
  /** Per-column pixel offset, in the same order as the columns. Live: the
   *  eye registry reads this every frame to correct its cached positions. */
  readonly offsets: number[]
  /** Re-measure after a resize. */
  remeasure(): void
  destroy(): void
}

/**
 * Scrolling for the desktop layout, where the four columns move in opposite
 * directions and so cannot ride a single native scrollbar.
 *
 * One input stream drives one value with inertia; each column translates by
 * that value times its direction, wrapped into one period. Wrapping is
 * invisible because every column holds its sequence twice.
 *
 * Three inputs feed that stream: the wheel, plain mouse movement, and touch
 * drag. Touch is the odd one out -- a finger pulls the content along with it,
 * so its sign is inverted against the other two, which push it away.
 */
export function startDrift(root: HTMLElement, columns: HTMLElement[]): Drift {
  const offsets = columns.map(() => 0)
  const periods = columns.map(() => 0)
  let target = 0
  let current = 0
  let raf = 0

  let dragging = false
  /** null until the pointer has been seen, so re-entering the window does not
   *  count the whole distance from wherever it left. */
  let lastPointerY: number | null = null
  let velocity = 0

  const remeasure = () => {
    columns.forEach((col, i) => (periods[i] = periodHeight(col)))
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    target += e.deltaY * WHEEL_MULTIPLIER
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    dragging = true
    velocity = 0
    lastPointerY = e.clientY
    root.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    const previous = lastPointerY
    lastPointerY = e.clientY
    if (previous === null) return
    const dy = e.clientY - previous

    if (e.pointerType === 'touch') {
      if (!dragging) return
      // a finger drags the content along with it
      velocity = -dy
      target += velocity
      return
    }
    // every mouse movement slides the feed, the same way a wheel notch does
    target += dy * MOVE_MULTIPLIER
  }

  const onPointerLeave = () => {
    lastPointerY = null
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    root.releasePointerCapture(e.pointerId)
    target += velocity * FLING
  }

  const frame = () => {
    raf = requestAnimationFrame(frame)
    current += (target - current) * LERP
    for (let i = 0; i < columns.length; i++) {
      const period = periods[i]!
      if (!period) continue
      const offset = columnOffset(current, i, period)
      offsets[i] = offset
      columns[i]!.style.transform = `translate3d(0, ${-offset}px, 0)`
    }
  }

  root.addEventListener('wheel', onWheel, { passive: false })
  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', onPointerUp)
  root.addEventListener('pointercancel', onPointerUp)
  root.addEventListener('pointerleave', onPointerLeave)

  remeasure()
  raf = requestAnimationFrame(frame)

  return {
    offsets,
    remeasure,
    destroy() {
      cancelAnimationFrame(raf)
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
      root.removeEventListener('pointerleave', onPointerLeave)
      for (const col of columns) col.style.transform = ''
      offsets.fill(0)
    },
  }
}
