import { STYLES } from '../data/styles'
import './eye.css'
import { asset } from '../system/asset'

export type EyeOptions = {
  /** Mirrors the sclera art. The art is drawn as a right eye, so the left
   *  one is the mirrored copy. */
  flip?: boolean
}

/**
 * One eye: sclera art plus a pupil anchored at the measured socket.
 * Only the sclera is mirrored — the pupil sprite stays in screen space so
 * Phase 2 can write the same offset to every eye without sign juggling.
 *
 * The caller sizes the eye by setting `--eye-w` on it or an ancestor.
 */
export function createEye(slug: string, { flip = false }: EyeOptions = {}): HTMLElement {
  const g = STYLES[slug]
  if (!g) throw new Error(`createEye: unknown style "${slug}"`)

  const [w, h] = g.eyeSize
  const el = document.createElement('div')
  el.className = flip ? 'eye eye--flip' : 'eye'
  el.dataset.style = slug
  el.style.setProperty('--aspect', String(h / w))
  el.style.setProperty('--socket-x', `${flip ? 100 - g.socket[0] : g.socket[0]}%`)
  el.style.setProperty('--socket-y', `${g.socket[1]}%`)
  el.style.setProperty('--ball-w', String(g.ballSize[0] / 100))
  el.style.setProperty('--ball-h', String(g.ballSize[1] / 100))
  // only drawn by the debug overlay, but kept next to the geometry it describes
  el.style.setProperty('--travel-x', String(g.travel[0] / 100))
  el.style.setProperty('--travel-y', String(g.travel[1] / 100))
  el.innerHTML =
    `<img class="eye__sclera" src="${asset(`styles/${slug}/eye.png`)}" alt="" decoding="async">` +
    `<img class="eye__ball" src="${asset(`styles/${slug}/ball.png`)}" alt="" decoding="async">`
  return el
}

export type EyePairOptions = {
  /** Centre of the pair, as percentages of the card box. */
  at: readonly [number, number]
  /** Eye width as a percentage of the card width. */
  size: number
  /**
   * Rotates the pair as one rigid body about its centre, in degrees — the
   * arrangement leans and both eyes lean with it.
   */
  tilt?: number
}

/**
 * A pair of eyes, placed on a card as a single unit.
 * The art is drawn as a right eye, so the left one is the mirrored copy.
 */
export function createEyePair(slug: string, { at, size, tilt = 0 }: EyePairOptions): HTMLElement {
  const style = STYLES[slug]
  if (!style) throw new Error(`createEyePair: unknown style "${slug}"`)

  const pair = document.createElement('div')
  pair.className = 'eye-pair'
  pair.style.setProperty('--at-x', `${at[0]}%`)
  pair.style.setProperty('--at-y', `${at[1]}%`)
  pair.style.setProperty('--eye-w', `${size}cqw`)
  // rotate: origin is the pair's own centre, so the group turns about its
  // midpoint rather than swinging around one eye
  if (tilt) pair.style.rotate = `${tilt}deg`

  if (style.singleEye) {
    // some characters (Mike) only have the one eye — no mirror, no gap.
    // The wrapper stays called .eye-pair: registry and the debug panel treat
    // it as "a group of eyes", not "exactly two eyes", so nothing else changes.
    pair.append(createEye(slug))
  } else {
    // spacing belongs to the style, not the card — see eye-tuning.ts
    pair.style.setProperty('--gap', String(style.gap))
    pair.append(createEye(slug, { flip: true }), createEye(slug))
  }

  // every eye inherits the rotation; the registry reads it per eye to keep a
  // tilted eye aiming at the target rather than beside it
  if (tilt) {
    for (const eye of pair.querySelectorAll<HTMLElement>('.eye')) eye.dataset.tilt = String(tilt)
  }
  return pair
}
