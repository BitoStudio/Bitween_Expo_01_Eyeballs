// node src/eyes/blink.selftest.ts
import assert from 'node:assert/strict'
import {
  firstBlinkAt,
  nextBlinkAt,
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

console.log('blink selftest: ok')
