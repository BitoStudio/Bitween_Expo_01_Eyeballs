/**
 * Where a pupil sits when looking at something `dx, dy` pixels away.
 *
 * The result is a direction vector scaled onto the travel ellipse, so
 * `(bx/travelX)² + (by/travelY)² ≤ 1` always holds — that is the guarantee
 * that keeps the pupil inside the sclera, given travel radii measured from
 * the art by scripts/prep-assets.mjs.
 *
 * Returns fractions of the eye box, ready to write to --bx / --by.
 * Checked by gaze.selftest.ts.
 */
export function gazeOffset(
  dx: number,
  dy: number,
  travelX: number,
  travelY: number,
  falloff: number,
): [number, number] {
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return [0, 0]
  // near targets deflect less, so a face right in front does not jitter the pupil
  const k = Math.min(d / falloff, 1)
  return [(dx / d) * travelX * k, (dy / d) * travelY * k]
}
