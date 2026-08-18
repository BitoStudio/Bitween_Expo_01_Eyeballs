import { MEASURED, STYLES } from '../data/styles'
import type { Registry } from '../eyes/registry'
import type { FaceTracker } from '../face/track'
import './panel.css'

/**
 * `?debug=1` only — dynamically imported, so none of this reaches the
 * production bundle. Tune travel until a pupil grazes the sclera, then copy
 * the snippet into TRAVEL_OVERRIDES in src/data/styles.ts.
 */
export function mountDebugPanel(registry: Registry, tracker: FaceTracker | null = null): HTMLElement {
  const panel = document.createElement('aside')
  panel.className = 'debug'
  panel.innerHTML = `
    <header class="debug__head">
      <strong>eye debug</strong><span class="debug__fps">–</span>
    </header>
    <p class="debug__status">–</p>
    <label class="debug__toggle">
      <input type="checkbox" class="debug__ellipse"> 顯示夾限橢圓
    </label>
    <div class="debug__row">
      <span title="目標多遠時瞳孔吃滿位移">falloff</span>
      <input type="number" class="debug__falloff" step="25" min="50" max="4000"
             value="${registry.getFalloff()}">
      <span class="debug__unit">px</span>
    </div>
    <div class="debug__legend">
      <span></span><span>travel x/y</span><span>socket dx/dy</span><span>眼距</span>
    </div>
    <div class="debug__rows"></div>
    <button class="debug__copy" type="button">複製 EYE_TUNING</button>`

  const rows = panel.querySelector('.debug__rows')!

  panel.querySelector<HTMLInputElement>('.debug__falloff')!.addEventListener('input', (e) => {
    registry.setFalloff(Number((e.target as HTMLInputElement).value))
  })

  /** Gap has no measured baseline, so the panel tracks its own live copy. */
  const gaps = new Map(registry.styleSlugs().map((slug) => [slug, STYLES[slug]!.gap]))

  /** Offsets are stored relative to the measured socket, which is what
   *  eye-tuning.ts wants — the panel never deals in absolute sockets. */
  const offsetOf = (slug: string): [number, number] => {
    const base = MEASURED[slug]!.socket
    const live = registry.getSocket(slug)!
    return [live[0] - base[0], live[1] - base[1]]
  }

  for (const slug of registry.styleSlugs()) {
    const [tx, ty] = registry.getTravel(slug)!
    const [dx, dy] = offsetOf(slug)
    const base = MEASURED[slug]!
    const row = document.createElement('div')
    row.className = 'debug__row'
    const num = (value: number, min: number, max: number, step = 0.5) =>
      `<input type="number" step="${step}" min="${min}" max="${max}" value="${value}">`
    row.innerHTML =
      `<span title="量測值 travel ${base.travel[0]},${base.travel[1]} · socket ${base.socket[0]},${base.socket[1]}">${slug}</span>` +
      num(+(tx * 100).toFixed(1), 0, 50) +
      num(+(ty * 100).toFixed(1), 0, 50) +
      num(+dx.toFixed(1), -40, 40) +
      num(+dy.toFixed(1), -40, 40) +
      num(STYLES[slug]!.gap, -1, 2, 0.05)

    row.addEventListener('input', () => {
      const [travelX, travelY, socketDX, socketDY, gap] = [...row.querySelectorAll('input')].map(
        (i) => Number(i.value),
      )
      const travel: [number, number] = [travelX! / 100, travelY! / 100]
      const socket: [number, number] = [base.socket[0] + socketDX!, base.socket[1] + socketDY!]
      registry.setTravel(slug, travel)
      registry.setSocket(slug, socket)

      // keep the rendered pupil and the overlay ellipse on the tuned centre
      for (const eye of document.querySelectorAll<HTMLElement>(`.eye[data-style="${slug}"]`)) {
        const flip = eye.classList.contains('eye--flip')
        eye.style.setProperty('--socket-x', `${flip ? 100 - socket[0] : socket[0]}%`)
        eye.style.setProperty('--socket-y', `${socket[1]}%`)
        eye.style.setProperty('--travel-x', String(travel[0]))
        eye.style.setProperty('--travel-y', String(travel[1]))
      }
      // spacing moves the eyes, so the cached positions have to go
      for (const pair of document.querySelectorAll<HTMLElement>('.eye-pair')) {
        if (pair.querySelector('.eye')?.getAttribute('data-style') !== slug) continue
        pair.style.setProperty('--gap', String(gap))
      }
      gaps.set(slug, gap!)
      registry.invalidate()
    })
    rows.append(row)
  }

  panel.querySelector<HTMLInputElement>('.debug__ellipse')!.addEventListener('change', (e) => {
    document.body.classList.toggle('show-travel', (e.target as HTMLInputElement).checked)
  })

  panel.querySelector<HTMLButtonElement>('.debug__copy')!.addEventListener('click', async (e) => {
    const body = registry
      .styleSlugs()
      .map((slug) => {
        const [x, y] = registry.getTravel(slug)!
        const [dx, dy] = offsetOf(slug)
        return (
          `  ${slug}: { travel: [${(x * 100).toFixed(1)}, ${(y * 100).toFixed(1)}], ` +
          `socketOffset: [${dx.toFixed(1)}, ${dy.toFixed(1)}], gap: ${gaps.get(slug)} },`
        )
      })
      .join('\n')
    const snippet =
      `export const EYE_TUNING: Partial<Record<StyleSlug, EyeTuning>> = {\n${body}\n}\n` +
      `// drop a \`travel\` entry to fall back to whatever prep-assets measures`
    const button = e.currentTarget as HTMLButtonElement
    try {
      await navigator.clipboard.writeText(snippet)
      button.textContent = '已複製 ✓'
    } catch {
      // clipboard needs a secure context; the console always works
      console.log(snippet)
      button.textContent = '已輸出到 console'
    }
    setTimeout(() => (button.textContent = '複製 EYE_TUNING'), 1600)
  })

  // Sits on the mirrored camera image where the system thinks the face is.
  // If it tracks your face, the mapping is right and any remaining complaint
  // about the eyes is a falloff/travel tuning question, not a maths bug.
  const crosshair = document.createElement('div')
  crosshair.className = 'debug-crosshair'
  document.body.append(crosshair)

  const fps = panel.querySelector('.debug__fps')!
  const status = panel.querySelector('.debug__status')!
  let frames = 0
  let since = performance.now()
  const tick = () => {
    frames++
    const now = performance.now()
    const gaze = registry.getGaze()
    crosshair.style.transform = `translate3d(${gaze.x}px, ${gaze.y}px, 0)`
    crosshair.style.opacity = String(gaze.gain)
    if (now - since >= 500) {
      fps.textContent = `${Math.round((frames * 1000) / (now - since))} fps`
      frames = 0
      since = now

      if (!tracker) {
        status.textContent = '無相機 · 跟隨滑鼠'
      } else {
        const { face, screen, fps: detectFps } = tracker.status()
        status.textContent =
          face && screen
            ? `臉 ${Math.round(screen[0])},${Math.round(screen[1])} · ` +
              `大小 ${(face.size * 100).toFixed(1)}% · 偵測 ${detectFps}Hz`
            : `找不到臉${registry.isEngaged() ? '…' : ' · 已歸位'} · 偵測 ${detectFps}Hz`
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  document.body.append(panel)
  return panel
}
