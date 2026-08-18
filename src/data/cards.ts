import type { EyePairOptions } from '../eyes/Eye'
import type { StyleSlug } from './styles'

export type Card = EyePairOptions & {
  /** Drives both the background and the eye art — a style is one matched set. */
  style: StyleSlug
}

/**
 * Hand-placed so the eyes land on empty areas of each background instead of
 * over its type. `at` is the centre of the pair; `size` is one eye's width,
 * both as percentages of the card.
 *
 * Rough empty zones per background:
 *   bitostyle  top 40%      girl  top 35%      cool  top 75%
 *   simpson    middle 25-60%              sponge  top 50%
 *
 * `tilt` rotates the pair as one rigid body about its centre — the whole
 * group leans, eyes included. Vary it hard: a page where every pair is level
 * reads as a template.
 *
 * Eye spacing is not here: it is a property of the eye art, so it lives per
 * style in eye-tuning.ts.
 */
export const CARDS: readonly Card[] = [
  { style: 'bitostyle', at: [50, 22], size: 26, tilt: -12 },
  { style: 'cool', at: [50, 34], size: 30, tilt: 8 },
  { style: 'simpson', at: [50, 42], size: 22, tilt: -28 },
  { style: 'sponge', at: [50, 27], size: 27, tilt: 18 },
  { style: 'girl', at: [50, 18], size: 17, tilt: 36 },
  { style: 'cool', at: [44, 28], size: 36, tilt: 24 },
  { style: 'bitostyle', at: [42, 20], size: 20, tilt: -34 },
  { style: 'simpson', at: [42, 40], size: 28, tilt: -5 },
  { style: 'sponge', at: [44, 24], size: 21, tilt: 14 },
  { style: 'girl', at: [44, 17], size: 22, tilt: -20 },
  { style: 'bitostyle', at: [58, 24], size: 30, tilt: 6 },
  { style: 'sponge', at: [56, 30], size: 33, tilt: -16 },
  { style: 'cool', at: [56, 40], size: 24, tilt: 30 },
  { style: 'simpson', at: [58, 45], size: 18, tilt: -9 },
  { style: 'girl', at: [56, 19], size: 14, tilt: 22 },
  { style: 'bitostyle', at: [50, 26], size: 23, tilt: -38 },
]
