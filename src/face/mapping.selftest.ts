// node src/face/mapping.selftest.ts
import assert from 'node:assert/strict'
import { faceToScreen } from './mapping.ts'

const near = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg} (${a} vs ${b})`)

// a 4:3 camera on a tall phone, and on a wide desktop
const cases = [
  { videoW: 640, videoH: 480, viewW: 390, viewH: 844 },
  { videoW: 640, videoH: 480, viewW: 1920, viewH: 1080 },
  { videoW: 1280, videoH: 720, viewW: 768, viewH: 1024 },
  { videoW: 640, videoH: 480, viewW: 640, viewH: 480 },
]

for (const { videoW, videoH, viewW, viewH } of cases) {
  const at = (nx: number, ny: number, mirrored = true) =>
    faceToScreen(nx, ny, videoW, videoH, viewW, viewH, mirrored)
  const label = `${videoW}x${videoH} -> ${viewW}x${viewH}`

  const [cx, cy] = at(0.5, 0.5)
  near(cx, viewW / 2, `${label}: centre stays centred in x`)
  near(cy, viewH / 2, `${label}: centre stays centred in y`)

  // cover: the frame reaches both edges, and never leaves a gap on either axis
  const [left] = at(1, 0.5)
  const [right] = at(0, 0.5)
  const [, top] = at(0.5, 0)
  const [, bottom] = at(0.5, 1)
  assert.ok(left <= 0 + 1e-9 && right >= viewW - 1e-9, `${label}: x must cover`)
  assert.ok(top <= 0 + 1e-9 && bottom >= viewH - 1e-9, `${label}: y must cover`)
  // exactly one axis overflows (the other fits precisely), unless ratios match
  const xTight = Math.abs(left) < 1e-9
  const yTight = Math.abs(top) < 1e-9
  assert.ok(xTight || yTight, `${label}: cover must pin at least one axis`)

  // mirroring reflects about the centre and nothing else
  for (const n of [0, 0.13, 0.5, 0.87, 1]) {
    const [mx, my] = at(n, 0.4)
    const [px, py] = at(1 - n, 0.4, false)
    near(mx, px, `${label}: mirrored ${n} matches unmirrored ${1 - n}`)
    near(my, py, `${label}: mirroring must not touch y`)
  }

  // someone on the left of the camera image shows up on the right when mirrored
  assert.ok(at(0.1, 0.5)[0] > at(0.9, 0.5)[0], `${label}: mirror flips left/right`)
  // and further down the frame is further down the screen
  assert.ok(at(0.5, 0.2)[1] < at(0.5, 0.8)[1], `${label}: y is not inverted`)
}

console.log('mapping selftest: ok')
