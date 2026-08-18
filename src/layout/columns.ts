import { CARDS, type Card } from '../data/cards'
import { createCard } from './feed'

/** Columns on the desktop layout. */
export const COLUMN_COUNT = 4
/**
 * Distinct cards per column before the sequence repeats. One repeat has to be
 * taller than the viewport, or the wrap would expose a gap.
 */
const PERIOD = 8
/**
 * Copies of that sequence in each column. Two is the minimum that lets a
 * column translate by a full period and still have content underneath.
 */
const REPEATS = 2

export type Columns = {
  root: HTMLElement
  columns: HTMLElement[]
}

/**
 * Four independent tracks, each holding its own rotation of the card list so
 * no two columns read the same, and each holding it twice so the drift engine
 * can wrap by one period without anything popping.
 *
 * On narrower screens the column boxes are removed by `display: contents`
 * (see layout.css) and the cards reflow into the single flat feed — same DOM,
 * no rebuild when the breakpoint changes.
 */
export function buildColumns(cards: readonly Card[] = CARDS): Columns {
  const root = document.createElement('div')
  root.className = 'feed'

  let index = 0
  const columns = Array.from({ length: COLUMN_COUNT }, (_, col) => {
    const el = document.createElement('div')
    el.className = 'feed__col'
    el.dataset.col = String(col)

    // Rotate the window into the card list. Stepping by PERIOD would wrap
    // straight back onto column 0 whenever the list is a multiple of it, so
    // spread the four starts evenly across the list instead.
    const offset = (col * Math.max(1, Math.floor(cards.length / COLUMN_COUNT))) % cards.length
    const period = Array.from(
      { length: PERIOD },
      (_, i) => cards[(offset + i) % cards.length]!,
    )
    for (let repeat = 0; repeat < REPEATS; repeat++) {
      for (const card of period) el.append(createCard(card, index++))
    }

    root.append(el)
    return el
  })

  return { root, columns }
}

/**
 * Height of one repeat, measured from the DOM rather than assumed, since card
 * heights come from image aspect ratios and the column width.
 */
export function periodHeight(column: HTMLElement): number {
  const cards = column.children
  const first = cards[0] as HTMLElement | undefined
  const wrapAt = cards[PERIOD] as HTMLElement | undefined
  if (!first || !wrapAt) return 0
  return wrapAt.offsetTop - first.offsetTop
}
