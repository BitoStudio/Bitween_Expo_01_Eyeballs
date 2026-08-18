import Lenis from 'lenis'

/**
 * Scroll feel. A wheel notch is a discrete jump; these turn it into something
 * with weight that coasts to a stop.
 *
 * `LERP` is the fraction of the remaining distance covered each frame, which
 * makes the curve an exponential ease-out: lower is heavier and glides
 * further, higher is snappier and stops sooner. 0.075 lands around a
 * half-second glide at 60fps.
 */
const LERP = 0.075
/** Scales a wheel notch. Above 1 the feed feels light and eager. */
const WHEEL_MULTIPLIER = 1.15

/** The one breakpoint that scrolls the page: below it the feed runs sideways
 *  on native touch momentum, above it the four columns drift under drift.ts. */
const TABLET = '(min-width: 768px) and (max-width: 1279px)'

export type ScrollController = { destroy(): void }

/**
 * Inertial page scrolling, for the tablet layout only.
 *
 * Mobile is left alone — a touch fling already has physics from the platform,
 * and hijacking it would fight both that and scroll-snap. Desktop does not
 * scroll the page at all: its columns travel in opposite directions, which no
 * single scrollbar can express, so drift.ts drives them by transform instead.
 *
 * `infinite` wraps back to the start rather than stopping at the end.
 */
export function startScroll(): ScrollController {
  const tablet = matchMedia(TABLET)
  let lenis: Lenis | null = null

  const apply = () => {
    lenis?.destroy()
    lenis = tablet.matches
      ? new Lenis({
          lerp: LERP,
          wheelMultiplier: WHEEL_MULTIPLIER,
          orientation: 'vertical',
          infinite: true,
          // touch on a tablet keeps its native fling
          syncTouch: false,
          autoRaf: true,
        })
      : null
  }

  apply()
  tablet.addEventListener('change', apply)

  return {
    destroy() {
      tablet.removeEventListener('change', apply)
      lenis?.destroy()
      lenis = null
    },
  }
}
