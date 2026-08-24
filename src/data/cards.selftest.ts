// node src/data/cards.selftest.ts
//
// Guards the one property that broke last time: columns.ts slices CARDS into
// fixed-size windows for the desktop layout, and mobile/tablet flattens the
// whole list into one scroll order. A style grouped into a same-style block
// puts that many identical eyes back to back wherever a window lands inside
// it — three doraemon cards in a row was exactly this, caught on screen and
// only fixable by re-ordering. This makes the ordering constraint permanent
// instead of something that has to be re-noticed by eye.
import assert from 'node:assert/strict'
import { CARDS } from './cards.ts'

assert.ok(CARDS.length > 1, 'CARDS needs at least two cards to check adjacency')

for (let i = 0; i < CARDS.length; i++) {
  const a = CARDS[i]!
  const b = CARDS[(i + 1) % CARDS.length]! // wraps: columns.ts windows the list circularly
  assert.notEqual(
    a.style,
    b.style,
    `CARDS[${i}] and CARDS[${(i + 1) % CARDS.length}] are both "${a.style}" — ` +
      `adjacent (or wrapping) same-style cards repeat on screen`,
  )
}

console.log('cards selftest: ok')
