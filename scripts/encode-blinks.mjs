// Turns the blink clips in Assets/Blink into PNG sprite sheets:
//   Assets/Blink/<clip>.webm -> Assets/Blink/sheets/<clip>.png  (unique frames, gridded)
//                            -> Assets/Blink/sheets/<clip>.json (timeline + geometry)
//
// Why not play the WebM directly: iOS Safari drops a WebM's alpha channel, and
// the HEVC-with-alpha it does understand needs an x265/VideoToolbox build most
// machines lack. A PNG keeps its alpha everywhere, and stepping a sprite from
// one clock keeps both eyes of a pair on exactly the same frame.
//
// Needs ffmpeg (with libvpx, for VP9 alpha) on PATH. Run after changing a clip:
//   npm run blinks
// The output is committed, so prep and CI never need ffmpeg. prep-assets
// refuses a sheet whose source clip has changed since it was made.
import { readdir, readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'
import { BLINKS, SHEET_GUTTER } from './blinks.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLIP_DIR = join(ROOT, 'Assets', 'Blink')
const SHEET_DIR = join(CLIP_DIR, 'sheets')
/** Codec noise between "identical" held frames stays under this per channel. */
const SAME_FRAME_TOLERANCE = 3
const ALPHA_MIN = 8
/** A blink reads the same at 30fps, and the sheet holds half the frames. */
const MAX_FPS = 30
/** Comfortably inside what every mobile GPU and image decoder accepts. */
const MAX_SHEET_SIDE = 4096

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' })
  assert(!r.error, 'encode-blinks: ffmpeg not found on PATH')
  assert.equal(r.status, 0, `ffmpeg ${args.join(' ')}\n${r.stderr}`)
  return r.stderr
}

function sameFrame(a, b) {
  for (let i = 0; i < a.data.length; i += 4) {
    // fully transparent pixels match whatever colour the codec left in them
    if (a.data[i + 3] <= ALPHA_MIN && b.data[i + 3] <= ALPHA_MIN) continue
    for (let c = 0; c < 4; c++)
      if (Math.abs(a.data[i + c] - b.data[i + c]) > SAME_FRAME_TOLERANCE) return false
  }
  return true
}

function opaqueBox({ data, width, height }) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_MIN) continue
      x0 = Math.min(x0, x), x1 = Math.max(x1, x)
      y0 = Math.min(y0, y), y1 = Math.max(y1, y)
    }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
}

async function encode(clip, mode) {
  const src = join(CLIP_DIR, clip)
  const bytes = await readFile(src)
  const sourceFps = Number(
    /(\d+(?:\.\d+)?) fps/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', src], { encoding: 'utf8' }).stderr)?.[1],
  )
  assert(sourceFps > 0, `${clip}: could not read the frame rate`)
  const step = Math.max(1, Math.round(sourceFps / MAX_FPS))
  const fps = sourceFps / step

  // libvpx-vp9 is forced because ffmpeg's built-in VP9 decoder drops alpha
  const tmp = await mkdtemp(join(tmpdir(), 'blink-'))
  try {
    ffmpeg(['-c:v', 'libvpx-vp9', '-i', src, '-an', '-pix_fmt', 'rgba', join(tmp, '%04d.png')])
    const names = (await readdir(tmp)).sort()
    const frames = await Promise.all(
      names.filter((_, i) => i % step === 0).map(async (n) => PNG.sync.read(await readFile(join(tmp, n)))),
    )
    assert(frames.length, `${clip}: no frames decoded`)
    const [w, h] = [frames[0].width, frames[0].height]

    const hasClear = frames.some((f) => f.data.some((v, i) => i % 4 === 3 && v <= ALPHA_MIN))
    assert(hasClear, `${clip}: every pixel is opaque — the clip has no alpha channel, re-export it with alpha`)

    // held frames (a closed eye, say) collapse to one sheet cell
    const unique = []
    const timeline = frames.map((f) => {
      const prev = unique.length - 1
      if (prev >= 0 && sameFrame(unique[prev], f)) return prev
      const seen = unique.findIndex((u) => sameFrame(u, f))
      if (seen >= 0) return seen
      unique.push(f)
      return unique.length - 1
    })

    const rest = opaqueBox(frames[0])
    if (mode === 'pupil') assert(rest, `${clip}: a pupil clip must start on a visible pupil`)
    else assert(!rest, `${clip}: a lid clip must start fully open (transparent)`)

    const cw = w + 2 * SHEET_GUTTER
    const ch = h + 2 * SHEET_GUTTER
    const cols = Math.ceil(Math.sqrt(unique.length))
    const rows = Math.ceil(unique.length / cols)
    assert(cols * cw <= MAX_SHEET_SIDE && rows * ch <= MAX_SHEET_SIDE, `${clip}: sheet too large`)
    const sheet = new PNG({ width: cols * cw, height: rows * ch })
    sheet.data.fill(0)
    unique.forEach((f, i) => {
      const ox = (i % cols) * cw + SHEET_GUTTER
      const oy = Math.floor(i / cols) * ch + SHEET_GUTTER
      for (let y = 0; y < h; y++) f.data.copy(sheet.data, ((oy + y) * sheet.width + ox) * 4, y * w * 4, (y + 1) * w * 4)
    })

    const base = clip.replace(/\.webm$/, '')
    await writeFile(join(SHEET_DIR, `${base}.png`), PNG.sync.write(sheet))
    const meta = {
      source: createHash('sha256').update(bytes).digest('hex'),
      frame: [w, h],
      gutter: SHEET_GUTTER,
      grid: [cols, rows],
      fps,
      // opaque box of the first frame: where the resting pupil sits
      rest,
      timeline,
    }
    await writeFile(join(SHEET_DIR, `${base}.json`), JSON.stringify(meta) + '\n')
    console.log(
      `  ${clip.padEnd(22)} ${w}x${h} @${fps}fps  ${frames.length} frames -> ${unique.length} unique, ` +
        `sheet ${sheet.width}x${sheet.height}`,
    )
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

await mkdir(SHEET_DIR, { recursive: true })
const clips = new Map(Object.values(BLINKS).map(({ clip, mode }) => [clip, mode]))
for (const [clip, mode] of clips) await encode(clip, mode)
console.log(`encode-blinks: ${clips.size} clips -> Assets/Blink/sheets/`)
