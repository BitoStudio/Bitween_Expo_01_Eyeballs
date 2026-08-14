// node src/eyes/gaze.selftest.ts
// Kept out of gaze.ts so no node import ever reaches the browser bundle.
import assert from 'node:assert/strict'
import { gazeOffset } from './gaze.ts'

const [TX, TY, F] = [0.28, 0.22, 400]

assert.deepEqual(gazeOffset(0, 0, TX, TY, F), [0, 0], 'no target, no offset')

for (let deg = 0; deg < 360; deg += 7) {
  const rad = (deg * Math.PI) / 180
  for (const dist of [1, 50, 399, 400, 401, 5000]) {
    const [bx, by] = gazeOffset(Math.cos(rad) * dist, Math.sin(rad) * dist, TX, TY, F)
    const inEllipse = (bx / TX) ** 2 + (by / TY) ** 2
    assert.ok(inEllipse <= 1.0001, `pupil escaped the ellipse at ${deg}deg/${dist}px`)
    // beyond the falloff the pupil must be fully deflected, never further
    if (dist >= F) assert.ok(Math.abs(inEllipse - 1) < 1e-9, 'should saturate at the rim')
  }
}

// direction is preserved, and deflection ramps linearly up to the falloff
const [rx, ry] = gazeOffset(200, 0, TX, TY, F)
assert.ok(Math.abs(rx - TX * 0.5) < 1e-9 && ry === 0, 'half falloff, half travel')
assert.equal(gazeOffset(-200, 0, TX, TY, F)[0], -rx, 'mirrored target, mirrored pupil')
assert.ok(gazeOffset(0, 200, TX, TY, F)[1] > 0, 'target below, pupil down')

console.log('gaze selftest: ok')
