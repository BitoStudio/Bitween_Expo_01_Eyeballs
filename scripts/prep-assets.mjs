// Puts everything the browser needs into public/:
//   Assets/<N>_<Name>/{Name}_{eye,ball,bg}.png
//     -> public/styles/<name>/{eye,ball,bg}.png (ball cropped to its alpha bbox)
//     -> src/data/styles.generated.ts           (eye geometry, see measureStyle)
//   node_modules/@mediapipe/tasks-vision/wasm/  -> public/wasm/
//
// Run: npm run prep         (also runs automatically before dev/build)
//      node scripts/prep-assets.mjs --selftest
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'Assets')
const OUT_DIR = join(ROOT, 'public', 'styles')
const OUT_TS = join(ROOT, 'src', 'data', 'styles.generated.ts')
const WASM_SRC = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const WASM_OUT = join(ROOT, 'public', 'wasm')

/** Keep the pupil this far inside the measured limit. Irregular sclera shapes
 *  (cool's D-shape, sponge's circle) need the margin; tune per style in Phase 2. */
const TRAVEL_SAFETY = 0.8
const ALPHA_MIN = 8
const WHITE_MIN = 200

/** Bounding box of pixels passing `keep`, inclusive. Null when nothing matches. */
function bbox({ data, width, height }, keep) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (!keep(data[i], data[i + 1], data[i + 2], data[i + 3])) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < x0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

const isOpaque = (_r, _g, _b, a) => a > ALPHA_MIN
const isSclera = (r, g, b, a) =>
  a > ALPHA_MIN * 20 && r > WHITE_MIN && g > WHITE_MIN && b > WHITE_MIN

function crop(png, box) {
  const out = new PNG({ width: box.w, height: box.h })
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y0 + y) * png.width + box.x0) * 4
    png.data.copy(out.data, y * box.w * 4, from, from + box.w * 4)
  }
  return out
}

/**
 * Pupil travel is an ellipse centred on the socket, so `|offset|` never exceeds
 * the radii — that is what keeps the ball inside the sclera at runtime.
 * All outputs are percentages of the eye canvas so the DOM can scale freely.
 */
function measureStyle(eye, ball) {
  const sclera = bbox(eye, isSclera) ?? bbox(eye, isOpaque)
  const ballBox = bbox(ball, isOpaque)
  assert(sclera, 'eye.png has no visible pixels')
  assert(ballBox, 'ball.png has no visible pixels')

  const pct = (v, total) => Math.round((v / total) * 1000) / 10
  const travel = (span, ballSpan) => Math.max(0, (span - ballSpan) / 2) * TRAVEL_SAFETY

  return {
    ballBox,
    geom: {
      eyeSize: [eye.width, eye.height],
      socket: [
        pct(sclera.x0 + sclera.w / 2, eye.width),
        pct(sclera.y0 + sclera.h / 2, eye.height),
      ],
      ballSize: [pct(ballBox.w, eye.width), pct(ballBox.h, eye.height)],
      travel: [
        pct(travel(sclera.w, ballBox.w), eye.width),
        pct(travel(sclera.h, ballBox.h), eye.height),
      ],
    },
  }
}

/**
 * The one hard visual requirement: the pupil must never poke outside the eye art.
 * Walks the travel ellipse and counts ball pixels landing on transparent eye
 * pixels, so re-cut art is re-validated on every `npm run prep`.
 */
function pupilOverflow(eye, ball, geom, scale = 1) {
  const [cx, cy] = [(geom.socket[0] / 100) * eye.width, (geom.socket[1] / 100) * eye.height]
  const [tx, ty] = [
    (geom.travel[0] / 100) * eye.width * scale,
    (geom.travel[1] / 100) * eye.height * scale,
  ]
  let worst = 0
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180
    const ox = Math.round(cx + Math.cos(rad) * tx - ball.width / 2)
    const oy = Math.round(cy + Math.sin(rad) * ty - ball.height / 2)
    let out = 0
    for (let y = 0; y < ball.height; y++) {
      for (let x = 0; x < ball.width; x++) {
        if (ball.data[(y * ball.width + x) * 4 + 3] <= ALPHA_MIN) continue
        const ex = ox + x, ey = oy + y
        const inside =
          ex >= 0 && ey >= 0 && ex < eye.width && ey < eye.height &&
          eye.data[(ey * eye.width + ex) * 4 + 3] > ALPHA_MIN
        if (!inside) out++
      }
    }
    worst = Math.max(worst, out)
  }
  return worst
}

async function readPng(path) {
  return PNG.sync.read(await readFile(path))
}

async function prepStyle(dir) {
  const files = await readdir(join(SRC_DIR, dir))
  const pick = (suffix) => {
    const f = files.find((n) => n.toLowerCase().endsWith(`_${suffix}.png`))
    assert(f, `${dir}: missing *_${suffix}.png`)
    return join(SRC_DIR, dir, f)
  }

  const [eye, ball, bgBytes] = await Promise.all([
    readPng(pick('eye')),
    readPng(pick('ball')),
    readFile(pick('bg')),
  ])
  assert.deepEqual(
    [ball.width, ball.height],
    [eye.width, eye.height],
    `${dir}: eye and ball must share one canvas`,
  )

  const slug = dir.replace(/^\d+_/, '').toLowerCase()
  const { ballBox, geom } = measureStyle(eye, ball)
  const bg = PNG.sync.read(bgBytes)

  const cropped = crop(ball, ballBox)
  const overflow = pupilOverflow(eye, cropped, geom)
  assert.equal(overflow, 0, `${slug}: pupil leaves the eye by ${overflow}px — lower TRAVEL_SAFETY`)
  const headroom = pupilOverflow(eye, cropped, geom, 1.25) === 0 ? ' (has headroom)' : ''

  const outDir = join(OUT_DIR, slug)
  await mkdir(outDir, { recursive: true })
  await Promise.all([
    writeFile(join(outDir, 'eye.png'), PNG.sync.write(eye)),
    writeFile(join(outDir, 'ball.png'), PNG.sync.write(cropped)),
    writeFile(join(outDir, 'bg.png'), bgBytes),
  ])

  return { slug, geom: { ...geom, bgSize: [bg.width, bg.height] }, headroom }
}

/**
 * The measured geometry is proven safe, but eye-tuning.ts can raise travel or
 * shove the socket past what the art allows — and an escaping pupil only shows
 * up at extreme gaze angles, which is exactly when nobody is looking at the
 * dev machine. Same pixel check, applied to the tuned numbers.
 */
async function checkTuning(styles) {
  const path = join(ROOT, 'src', 'data', 'eye-tuning.ts')
  const { EYE_TUNING } = await import(pathToFileURL(path).href)

  const problems = []
  for (const [slug, base] of Object.entries(styles)) {
    const tuning = EYE_TUNING?.[slug]
    if (!tuning) continue
    const [dx, dy] = tuning.socketOffset ?? [0, 0]
    if (!tuning.travel && !dx && !dy) continue

    const geom = {
      socket: [base.socket[0] + dx, base.socket[1] + dy],
      travel: tuning.travel ?? base.travel,
    }
    const [eye, ball] = await Promise.all([
      readPng(join(OUT_DIR, slug, 'eye.png')),
      readPng(join(OUT_DIR, slug, 'ball.png')),
    ])
    const overflow = pupilOverflow(eye, ball, geom)
    if (!overflow) continue

    if (tuning.allowOverflow) {
      console.log(`  ${slug.padEnd(10)} pupil rides outside the art by design (allowOverflow)`)
      continue
    }

    // largest travel that still fits, so the message says what to type
    let fits = 0
    for (let scale = 0.95; scale > 0; scale -= 0.05) {
      if (!pupilOverflow(eye, ball, geom, scale)) {
        fits = scale
        break
      }
    }
    const safe = geom.travel.map((v) => Math.floor(v * fits * 10) / 10)
    problems.push(
      `  ${slug}: travel [${geom.travel}] with socketOffset [${dx}, ${dy}] pushes the ` +
        `pupil outside the art — largest that fits is about [${safe}].\n` +
        `    Set allowOverflow: true if that is intended.`,
    )
  }

  assert.equal(
    problems.length,
    0,
    `eye-tuning.ts lets a pupil escape its eye:\n${problems.join('\n')}\n` +
      `Lower travel, or pull socketOffset back towards 0.`,
  )
}

async function main() {
  const dirs = (await readdir(SRC_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
  assert(dirs.length, `no style folders in ${SRC_DIR}`)

  await rm(OUT_DIR, { recursive: true, force: true })
  const results = await Promise.all(dirs.map(prepStyle))
  const styles = Object.fromEntries(results.map((r) => [r.slug, r.geom]))

  for (const { slug, geom: g, headroom } of results) {
    const [tx, ty] = g.travel
    assert(tx > 0 && ty > 0, `${slug}: pupil has no room to move — check the art`)
    for (const [x, y] of [g.socket, g.ballSize])
      assert(x > 0 && x <= 100 && y > 0 && y <= 100, `${slug}: geometry out of range`)
    console.log(
      `  ${slug.padEnd(10)} eye ${g.eyeSize.join('x')}  socket ${g.socket.join(',')}%` +
        `  travel ±${tx},${ty}%${headroom}`,
    )
  }

  // Self-host the MediaPipe runtime: an expo stand cannot depend on a CDN.
  // FilesetResolver.forVisionTasks only ever asks for the plain or the nosimd
  // build, picked from what the browser supports. The _module_ pair belongs to
  // a loader we do not use and is 12MB of dead weight over venue wifi.
  await rm(WASM_OUT, { recursive: true, force: true })
  await mkdir(WASM_OUT, { recursive: true })
  const wasmFiles = (await readdir(WASM_SRC)).filter((n) => !n.includes('_module_'))
  assert(wasmFiles.length, `no MediaPipe runtime in ${WASM_SRC}`)
  await Promise.all(wasmFiles.map((n) => cp(join(WASM_SRC, n), join(WASM_OUT, n))))

  // `as const` gives exact tuples, so src/data/styles.ts needs no casts
  await mkdir(dirname(OUT_TS), { recursive: true })
  await writeFile(
    OUT_TS,
    `// Generated by scripts/prep-assets.mjs — do not edit; run \`npm run prep\`.\n` +
      `export default ${JSON.stringify(styles, null, 2)} as const\n`,
  )

  await checkTuning(styles)
  console.log(`prep-assets: ${dirs.length} styles -> public/styles/, styles.generated.ts`)
}

/** Synthetic checks for the geometry maths — real assets only cover today's art. */
function selftest() {
  const make = (w, h, paint) => {
    const png = new PNG({ width: w, height: h })
    png.data.fill(0)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = paint(x, y)
        if (c) png.data.set(c, (y * w + x) * 4)
      }
    return png
  }

  // 100x100 white sclera inset by 10px; 20x20 opaque ball parked off-centre.
  const eye = make(100, 100, (x, y) =>
    x >= 10 && x < 90 && y >= 10 && y < 90 ? [255, 255, 255, 255] : null,
  )
  const ball = make(100, 100, (x, y) =>
    x >= 5 && x < 25 && y >= 70 && y < 90 ? [0, 0, 0, 255] : null,
  )

  const { ballBox, geom } = measureStyle(eye, ball)
  assert.deepEqual([ballBox.x0, ballBox.y0, ballBox.w, ballBox.h], [5, 70, 20, 20])
  // socket follows the sclera, NOT the ball's painted position
  assert.deepEqual(geom.socket, [50, 50])
  assert.deepEqual(geom.ballSize, [20, 20])
  // (80 - 20) / 2 * 0.8 = 24
  assert.deepEqual(geom.travel, [24, 24])

  const cropped = crop(ball, ballBox)
  assert.deepEqual([cropped.width, cropped.height], [20, 20])
  assert.equal(cropped.data[3], 255, 'crop must keep the top-left pupil pixel')
  assert.equal(bbox(cropped, isOpaque).w, 20, 'cropped ball must be edge-to-edge')

  // the guarantee itself: measured travel keeps the pupil in, inflated travel breaks it
  assert.equal(pupilOverflow(eye, cropped, geom), 0, 'pupil should fit at measured travel')
  assert.ok(
    pupilOverflow(eye, cropped, geom, 2) > 0,
    'overflow detector is blind — it must catch an oversized travel radius',
  )

  assert.throws(() => measureStyle(make(4, 4, () => null), ball), /no visible pixels/)
  console.log('prep-assets selftest: ok')
}

if (process.argv.includes('--selftest')) selftest()
else await main()
