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
}

export const EYE_TUNING: Partial<Record<StyleSlug, EyeTuning>> = {
  bitostyle: { socketOffset: [0, 0] },
  girl: { socketOffset: [0, 0] },
  cool: { socketOffset: [0, 0] },
  simpson: { socketOffset: [0, 0] },
  sponge: { socketOffset: [0, 0] },
}
