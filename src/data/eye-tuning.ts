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
}

export const EYE_TUNING: Partial<Record<StyleSlug, EyeTuning>> = {
  bitostyle: { socketOffset: [0, 0], gap: 0.3 },
  // Art direction: the pupil sits high, like the artist drew it, and is meant
  // to ride past the lid at extreme angles. Checked on screen and kept.
  cool: { travel: [31.5, 38], socketOffset: [0, -15], gap: 0.22, allowOverflow: true },
  // the two circles are meant to touch and overlap
  simpson: { socketOffset: [0, 0], gap: -0.15 },
  sponge: { socketOffset: [0, 0], gap: 0.3 },
  girl: { travel: [20, 19], socketOffset: [-20, 0], gap: 0.4 },
}
