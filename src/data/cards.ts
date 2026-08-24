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
 *   bitostyle  top 40%           girl   top 35%          cool   top 75%
 *   simpson    middle 25-60%     sponge top 50%
 *   doraemon   text fills the whole card — top edge has the least of it
 *   fashion    right ~45% (its own bg.png, but bitostyle's eye/ball art)
 *   perry      top-left quadrant
 *   mike       no text at all — just stay off the thick diagonal lines
 *
 * `tilt` rotates the pair as one rigid body about its centre — the whole
 * group leans, eyes included. Vary it hard: a page where every pair is level
 * reads as a template.
 *
 * Eye spacing is not here: it is a property of the eye art, so it lives per
 * style in eye-tuning.ts. Mike is drawn with a single eye (see `singleEye`
 * there) — `at`/`size`/`tilt` work the same, there's just one eye instead of
 * a mirrored pair.
 *
 * Order matters: columns.ts slices this into fixed-size windows per desktop
 * column, and on mobile/tablet the whole thing flattens into one scroll
 * order. Grouping a style's cards together (all the doraemon entries in a
 * row, say) put three of the same eyes back to back wherever a window landed
 * inside that block. So this list round-robins across styles — one card per
 * style per lap — rather than being authored as style-then-style blocks.
 * cards.selftest.ts asserts no two entries in a row (wrapping around) share a
 * style; keep that property when adding more.
 */
export const CARDS: readonly Card[] = [
  { style: 'cool', at: [50, 34], size: 30, tilt: 8 },
  { style: 'simpson', at: [50, 42], size: 22, tilt: -28 },
  { style: 'sponge', at: [50, 27], size: 27, tilt: 18 },
  { style: 'girl', at: [50, 18], size: 17, tilt: 36 },
  { style: 'bitostyle', at: [50, 22], size: 26, tilt: -12 },
  { style: 'doraemon', at: [50, 12], size: 24, tilt: -10 },
  { style: 'fashion', at: [74, 24], size: 25, tilt: 20 },
  { style: 'perry', at: [22, 18], size: 26, tilt: -18 },
  { style: 'mike', at: [50, 68], size: 46, tilt: -15 },

  { style: 'cool', at: [44, 28], size: 36, tilt: 24 },
  { style: 'simpson', at: [42, 40], size: 28, tilt: -5 },
  { style: 'sponge', at: [44, 24], size: 21, tilt: 14 },
  { style: 'girl', at: [44, 17], size: 22, tilt: -20 },
  { style: 'bitostyle', at: [42, 20], size: 20, tilt: -34 },
  { style: 'doraemon', at: [44, 10], size: 20, tilt: 16 },
  { style: 'fashion', at: [70, 32], size: 21, tilt: -14 },
  { style: 'perry', at: [26, 24], size: 21, tilt: 12 },
  { style: 'mike', at: [30, 78], size: 34, tilt: 24 },

  { style: 'cool', at: [56, 40], size: 24, tilt: 30 },
  { style: 'simpson', at: [58, 45], size: 18, tilt: -9 },
  { style: 'sponge', at: [56, 30], size: 33, tilt: -16 },
  { style: 'girl', at: [56, 19], size: 14, tilt: 22 },
  { style: 'bitostyle', at: [58, 24], size: 30, tilt: 6 },
  { style: 'doraemon', at: [56, 13], size: 27, tilt: -22 },
  { style: 'fashion', at: [76, 18], size: 29, tilt: 8 },
  { style: 'perry', at: [20, 14], size: 30, tilt: -6 },
  { style: 'mike', at: [70, 15], size: 40, tilt: -30 },

  // bitostyle has a 4th card and no other style does; placed here (not at the
  // very start) so it never lands next to the array's own wrap-around start
  { style: 'bitostyle', at: [50, 26], size: 23, tilt: -38 },
]
