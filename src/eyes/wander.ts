/**
 * Idle motion for a pair with nothing to look at: an organic drift to a new
 * random spot every couple of seconds, eased rather than snapped to.
 *
 * State lives in the travel ellipse's own unit-disk space (x²+y² ≤ 1), the
 * same domain registry.ts scales by a style's (travel-x, travel-y) to get a
 * screen offset — so this module never has to know what style it belongs to.
 *
 * Every value here is bounded: the chosen target always has radius ≤
 * WANDER_MAX_RADIUS ≤ 1, and each step moves the current point along the
 * straight segment toward that target by a fixed fraction. A point on the
 * segment between two points inside the unit disk is itself inside the unit
 * disk (the disk is convex) — so by induction from the (0,0) start, the
 * state can never leave it. That is what keeps the pupil off the sclera edge
 * during a change of target, not a clamp. Checked by wander.selftest.ts.
 */
export type WanderState = {
  readonly x: number
  readonly y: number
  readonly angle: number
  readonly radius: number
  /** Timestamp (same clock as `now` below) of the next re-target. */
  readonly nextAt: number
}

/** How far into the travel ellipse a glance goes — never the full radius, so
 *  it never rides the sclera edge the way a tracked gaze at point-blank can. */
export const WANDER_MIN_RADIUS = 0.2
export const WANDER_MAX_RADIUS = 0.85
/** How long one glance is held before drifting to the next. */
export const WANDER_MIN_INTERVAL_MS = 1200
export const WANDER_MAX_INTERVAL_MS = 3200
/** Fraction of the remaining distance covered per frame — slower than the
 *  tracked-gaze SMOOTHING in registry.ts, so idle eyes drift, not snap. */
const WANDER_LERP = 0.02

export function initialWander(now: number): WanderState {
  return { x: 0, y: 0, angle: 0, radius: 0, nextAt: now }
}

/** Advances one frame. `rand` is injectable so the selftest can drive it. */
export function stepWander(state: WanderState, now: number, rand: () => number = Math.random): WanderState {
  let { angle, radius, nextAt } = state
  if (now >= nextAt) {
    angle = rand() * Math.PI * 2
    radius = WANDER_MIN_RADIUS + rand() * (WANDER_MAX_RADIUS - WANDER_MIN_RADIUS)
    nextAt = now + WANDER_MIN_INTERVAL_MS + rand() * (WANDER_MAX_INTERVAL_MS - WANDER_MIN_INTERVAL_MS)
  }
  const targetX = Math.cos(angle) * radius
  const targetY = Math.sin(angle) * radius
  return {
    x: state.x + (targetX - state.x) * WANDER_LERP,
    y: state.y + (targetY - state.y) * WANDER_LERP,
    angle,
    radius,
    nextAt,
  }
}
