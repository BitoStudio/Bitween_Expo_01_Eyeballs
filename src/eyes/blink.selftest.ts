// node src/eyes/blink.selftest.ts
import assert from 'node:assert/strict'
import {
  blinkFrame,
  firstBlinkAt,
  nextBlinkAt,
  sheetPosition,
  BLINK_MIN_INTERVAL_MS,
  BLINK_MAX_INTERVAL_MS,
  BLINK_STALE_MS,
} from './blink.ts'

assert.ok(BLINK_MIN_INTERVAL_MS > BLINK_STALE_MS, 'a fresh schedule must never already count as stale')

for (const r of [0, 0.25, 0.5, 0.999999]) {
  const first = firstBlinkAt(1000, () => r)
  assert.ok(first >= 1000 && first < 1000 + BLINK_MAX_INTERVAL_MS, `first blink out of range at rand=${r}`)

  const next = nextBlinkAt(1000, () => r)
  assert.ok(
    next >= 1000 + BLINK_MIN_INTERVAL_MS && next < 1000 + BLINK_MAX_INTERVAL_MS,
    `next blink out of range at rand=${r}`,
  )
}

// pairs built in the same frame must not all blink together
const starts = new Set(Array.from({ length: 20 }, () => Math.round(firstBlinkAt(0))))
assert.ok(starts.size > 10, 'first blinks should be spread out')

// 30fps, 3 frames: 0..33ms is frame 0, the clip is over at 100ms
assert.equal(blinkFrame(0, 30, 3), 0)
assert.equal(blinkFrame(34, 30, 3), 1)
assert.equal(blinkFrame(99, 30, 3), 2)
assert.equal(blinkFrame(100, 30, 3), -1)
assert.equal(blinkFrame(-5, 30, 3), 0, 'a start stamped a hair in the future is still frame 0')

// 3x2 sheet: cells run left to right, then down
assert.equal(sheetPosition(0, [3, 2]), '0% 0%')
assert.equal(sheetPosition(2, [3, 2]), '100% 0%')
assert.equal(sheetPosition(4, [3, 2]), '50% 100%')
assert.equal(sheetPosition(1, [2, 1]), '100% 0%', 'a single row must not divide by zero')

console.log('blink selftest: ok')
