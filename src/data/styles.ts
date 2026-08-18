// Geometry is measured from the art by scripts/prep-assets.mjs — run `npm run prep`
// after the art changes. Hand tweaks live in eye-tuning.ts and are layered on
// top here, so the rest of the app only ever sees the final numbers.
import { EYE_TUNING } from './eye-tuning'
import generated from './styles.generated'

/** Percentages of the eye canvas, except eyeSize/bgSize which are pixels. */
export type EyeStyle = {
  /** Intrinsic eye canvas size, used for the default aspect ratio. */
  readonly eyeSize: readonly [number, number]
  /** Centre of the sclera — the pupil's rest position, not where the art drew it. */
  readonly socket: readonly [number, number]
  readonly ballSize: readonly [number, number]
  /** Radii of the ellipse the pupil may travel within. Verified against the art. */
  readonly travel: readonly [number, number]
  /** Space between a pair's two eyes, in multiples of one eye width. */
  readonly gap: number
  readonly bgSize: readonly [number, number]
}

/** Nothing in the art says how far apart a pair should sit, so this is just a
 *  sane starting point for a style with no `gap` in eye-tuning.ts. */
const DEFAULT_GAP = 0.25

export type StyleSlug = keyof typeof generated

/** Straight from the art, before any tuning — the debug panel needs the
 *  baseline to express its edits as offsets. */
export const MEASURED: Record<string, EyeStyle> = Object.fromEntries(
  Object.entries(generated).map(([slug, style]) => [slug, { ...style, gap: DEFAULT_GAP }]),
)

export const STYLES: Record<string, EyeStyle> = Object.fromEntries(
  Object.entries(generated).map(([slug, style]) => {
    const tuning = EYE_TUNING[slug as StyleSlug]
    const [dx, dy] = tuning?.socketOffset ?? [0, 0]
    return [
      slug,
      {
        ...style,
        travel: tuning?.travel ?? style.travel,
        socket: [style.socket[0] + dx, style.socket[1] + dy],
        gap: tuning?.gap ?? DEFAULT_GAP,
      },
    ]
  }),
)

export const STYLE_SLUGS = Object.keys(STYLES) as StyleSlug[]
