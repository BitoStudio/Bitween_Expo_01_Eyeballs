/**
 * The maths behind the drifting desktop columns. No imports, so it runs
 * straight through node — see wrap.selftest.ts.
 */

/** Column 0 and 2 travel one way, 1 and 3 the other. */
export const direction = (col: number) => (col % 2 === 0 ? 1 : -1)

/**
 * How far a column is translated up, for a given amount of accumulated input.
 *
 * Always inside `[0, period)`: the column holds its card sequence twice, so
 * folding the travel back to the start of the second copy is invisible. The
 * fold has to survive negative travel too — the odd columns run backwards, and
 * the whole thing goes negative the moment someone scrolls up from a standstill.
 */
export function columnOffset(progress: number, col: number, period: number): number {
  if (period <= 0) return 0
  const travelled = progress * direction(col)
  return ((travelled % period) + period) % period
}
