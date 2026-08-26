import type { StyleSlug } from './styles'

/**
 * Hand tuning per eye style, layered on top of what scripts/prep-assets.mjs
 * measures from the art. Edit this file — `?debug=1` lets you drag the values
 * around on screen and copies a ready-made replacement for the block below.
 *
 * Everything here is a percentage of the eye box and lives in the eye's own
 * frame, so it rotates with a tilted pair automatically.
 */
export type EyeTuning = {
  /**
   * Radii of the pupil's travel ellipse. Omit to keep the measured value —
   * which prep-assets already proved keeps the pupil inside the art, and
   * re-proves whenever the art changes.
   */
  travel?: readonly [number, number]
  /**
   * Nudges the ellipse centre, which is also the pupil's resting position,
   * away from the measured socket. Positive x is towards the outer edge of
   * the eye; mirrored for the left eye so a pair stays symmetric.
   */
  socketOffset?: readonly [number, number]
  /**
   * Space between the two eyes of a pair, in multiples of one eye width.
   * Negative overlaps them — the right eye then sits on top, pupil included.
   */
  gap?: number
  /**
   * Lets the pupil travel past the edge of the sclera art. `npm run prep`
   * fails on that by default, so anything overflowing is a deliberate,
   * recorded decision rather than a typo that survived to the venue.
   */
  allowOverflow?: boolean
  /**
   * The character only has the one eye (Mike) — createEyePair renders a
   * single unmirrored eye instead of a pair. `gap` is then ignored.
   */
  singleEye?: boolean
}

export const EYE_TUNING: Partial<Record<StyleSlug, EyeTuning>> = {
  // Art direction: the pupil sits high and rides well past the lid at extreme
  // angles — over half its area at the worst angle, and it already clips
  // slightly at rest. Checked on screen and kept.
  cool: { travel: [40.5, 18.5], socketOffset: [0.0, -32.5], gap: 0.25, allowOverflow: true },
  simpson: { travel: [31.1, 28.5], socketOffset: [0.0, 0.0], gap: -0.15 },
  sponge: { travel: [20.1, 17.0], socketOffset: [0.0, 0.0], gap: -0.03 },
  girl: { travel: [13.0, 14.0], socketOffset: [-20.0, 0.0], gap: 0.25 },
  bitostyle: { travel: [16.0, 7.5], socketOffset: [0.0, 0.0], gap: 0.25 },
  doraemon: { travel: [23.9, 22.3], socketOffset: [0.0, 0.0], gap: -0.03 },
  fashion: { travel: [26.0, 9.0], socketOffset: [0.0, 0.0], gap: 0 },
  perry: { travel: [19.5, 16.3], socketOffset: [-2.5, 0.0], gap: 0.3 },
  // Mike Wazowski: one eye, no partner to space against. Not something the
  // debug panel's copy button exports — singleEye is a structural flag, not
  // a slider — so it has to survive every panel-sourced replacement by hand.
  mike: { travel: [22.1, 20.3], socketOffset: [0.0, 0.0], gap: 0.25, singleEye: true },
}
