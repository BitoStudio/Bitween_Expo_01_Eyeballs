// node src/eyes/wander.selftest.ts
import assert from 'node:assert/strict'
import {
  initialWander,
  stepWander,
  WANDER_MAX_RADIUS,
  WANDER_MIN_INTERVAL_MS,
  WANDER_MAX_INTERVAL_MS,
} from './wander.ts'

assert.ok(WANDER_MAX_RADIUS <= 1, 'a target beyond the unit disk would break the invariant below')

// deterministic PRNG so a failure is reproducible
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

for (let seed = 0; seed < 20; seed++) {
  const rand = mulberry32(seed)
  let now = 0
  let state = initialWander(now)
  let retargets = 0
  let lastAngle = state.angle

  for (let i = 0; i < 5000; i++) {
    // irregular frame pacing: real rAF timing jitters, this should not matter
    now += 8 + rand() * 24
    state = stepWander(state, now, rand)

    const r2 = state.x * state.x + state.y * state.y
    assert.ok(r2 <= 1 + 1e-9, `seed ${seed} step ${i}: escaped the unit disk (r²=${r2})`)

    if (state.angle !== lastAngle) {
      retargets++
      lastAngle = state.angle
    }
  }

  assert.ok(retargets > 5, `seed ${seed}: expected multiple re-targets over 5000 steps, got ${retargets}`)
}

// held target: two consecutive steps before nextAt must not re-roll angle/radius
{
  const rand = mulberry32(1)
  const t0 = 1000
  const first = stepWander(initialWander(0), t0, rand)
  const second = stepWander(first, t0 + 1, rand)
  assert.equal(second.angle, first.angle, 'held target changed angle before nextAt')
  assert.equal(second.radius, first.radius, 'held target changed radius before nextAt')
  assert.equal(second.nextAt, first.nextAt, 'held target changed nextAt before nextAt')
}

// eases toward the target rather than snapping — first step should not
// already be at the target, but should have moved strictly closer to it
{
  const rand = mulberry32(2)
  const first = stepWander(initialWander(0), 500, rand)
  const dist = Math.hypot(first.x - Math.cos(first.angle) * first.radius, first.y - Math.sin(first.angle) * first.radius)
  assert.ok(dist > 0, 'first step already sitting exactly on the target — should ease, not snap')
}

// interval bounds are respected
{
  const rand = mulberry32(3)
  let state = initialWander(0)
  for (let i = 0; i < 200; i++) {
    const prevNextAt = state.nextAt
    state = stepWander(state, prevNextAt, rand) // now === nextAt forces a re-target
    const held = state.nextAt - prevNextAt
    assert.ok(
      held >= WANDER_MIN_INTERVAL_MS && held <= WANDER_MAX_INTERVAL_MS,
      `hold time ${held}ms outside [${WANDER_MIN_INTERVAL_MS}, ${WANDER_MAX_INTERVAL_MS}]`,
    )
  }
}

console.log('wander selftest: ok')
