// node src/layout/drift.selftest.ts
import assert from 'node:assert/strict'
import { columnOffset, direction } from './wrap.ts'

const PERIOD = 2955

// four columns, alternating: 0 and 2 one way, 1 and 3 the other
assert.deepEqual([0, 1, 2, 3].map(direction), [1, -1, 1, -1])

// at rest every column sits on its first card
for (const col of [0, 1, 2, 3]) assert.equal(columnOffset(0, col, PERIOD), 0)

// a column with no measured height must not divide by it
assert.equal(columnOffset(500, 0, 0), 0)

for (const col of [0, 1, 2, 3]) {
  // scrolling down moves the even columns on and the odd ones the other way,
  // which is the whole point of the layout
  const step = columnOffset(100, col, PERIOD)
  assert.equal(step, direction(col) === 1 ? 100 : PERIOD - 100, `col ${col} direction`)

  // the offset never leaves the window the duplicated content covers,
  // including deep into negative travel from scrolling up at the start
  for (let progress = -12 * PERIOD; progress <= 12 * PERIOD; progress += PERIOD / 37) {
    const offset = columnOffset(progress, col, PERIOD)
    assert.ok(offset >= 0 && offset < PERIOD, `col ${col} left the period at ${progress}`)
  }

  // one period of travel lands back exactly where it started — that identity
  // is what makes the wrap invisible
  for (const progress of [0, 137.5, -4210, 99999]) {
    const here = columnOffset(progress, col, PERIOD)
    const lap = columnOffset(progress + PERIOD, col, PERIOD)
    assert.ok(Math.abs(here - lap) < 1e-9, `col ${col} is not periodic at ${progress}`)
  }

  // motion stays continuous across the seam: no step bigger than the input,
  // apart from the single wrap of exactly one period
  let previous = columnOffset(-PERIOD * 1.5, col, PERIOD)
  for (let progress = -PERIOD * 1.5; progress <= PERIOD * 1.5; progress += 7) {
    const offset = columnOffset(progress, col, PERIOD)
    const moved = Math.abs(offset - previous)
    assert.ok(moved <= 7 + 1e-9 || Math.abs(moved - PERIOD) <= 7, `col ${col} jumped ${moved}px`)
    previous = offset
  }
}

console.log('wrap selftest: ok')
