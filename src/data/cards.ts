import type { EyePairOptions } from '../eyes/Eye'
import type { StyleSlug } from './styles'

export type Card = EyePairOptions & {
  /** Style slug whose bg.png backs the card. */
  bg: StyleSlug
  /** Style slug whose eye art sits on it — deliberately not always `bg`. */
  eyes: StyleSlug
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
 */
export const CARDS: readonly Card[] = [
  { bg: 'bitostyle', eyes: 'bitostyle', at: [50, 22], size: 26, gap: 0.3, tilt: -12 },
  { bg: 'cool', eyes: 'cool', at: [50, 34], size: 30, gap: 0.22, tilt: 8 },
  { bg: 'simpson', eyes: 'simpson', at: [50, 42], size: 22, gap: 0.5, tilt: -28 },
  { bg: 'sponge', eyes: 'sponge', at: [50, 27], size: 27, gap: 0.3, tilt: 18 },
  { bg: 'girl', eyes: 'girl', at: [50, 18], size: 17, gap: 0.55, tilt: 36 },
  { bg: 'simpson', eyes: 'bitostyle', at: [50, 42], size: 28, gap: 0.2, tilt: -5 },
  { bg: 'cool', eyes: 'sponge', at: [46, 30], size: 34, gap: 0.18, tilt: 24 },
  { bg: 'bitostyle', eyes: 'simpson', at: [52, 20], size: 20, gap: 0.45, tilt: -34 },
  { bg: 'sponge', eyes: 'girl', at: [50, 26], size: 16, gap: 0.6, tilt: 14 },
  { bg: 'girl', eyes: 'cool', at: [50, 17], size: 24, gap: 0.3, tilt: -20 },
  { bg: 'cool', eyes: 'bitostyle', at: [50, 36], size: 32, gap: 0.24, tilt: 6 },
  { bg: 'simpson', eyes: 'sponge', at: [50, 42], size: 25, gap: 0.3, tilt: -16 },
  { bg: 'bitostyle', eyes: 'cool', at: [48, 21], size: 27, gap: 0.26, tilt: 30 },
  { bg: 'sponge', eyes: 'simpson', at: [52, 25], size: 21, gap: 0.4, tilt: -9 },
  { bg: 'girl', eyes: 'sponge', at: [50, 18], size: 19, gap: 0.35, tilt: 22 },
  { bg: 'cool', eyes: 'girl', at: [50, 32], size: 18, gap: 0.5, tilt: -38 },
]
