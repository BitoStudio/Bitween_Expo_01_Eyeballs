import { STYLES } from '../data/styles'
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
    <div class="debug__rows"></div>
    <button class="debug__copy" type="button">複製 TRAVEL_OVERRIDES</button>`

  const rows = panel.querySelector('.debug__rows')!

  panel.querySelector<HTMLInputElement>('.debug__falloff')!.addEventListener('input', (e) => {
    registry.setFalloff(Number((e.target as HTMLInputElement).value))
  })

  for (const slug of registry.styleSlugs()) {
    const [tx, ty] = registry.getTravel(slug)!
    const measured = STYLES[slug]!.travel
    const row = document.createElement('div')
    row.className = 'debug__row'
    row.innerHTML = `
      <span title="量測值 ${measured[0]}, ${measured[1]}">${slug}</span>
      <input type="number" step="0.5" min="0" max="50" value="${(tx * 100).toFixed(1)}" data-axis="x">
      <input type="number" step="0.5" min="0" max="50" value="${(ty * 100).toFixed(1)}" data-axis="y">`

    row.addEventListener('input', () => {
      const [ix, iy] = row.querySelectorAll('input')
      const next: [number, number] = [Number(ix!.value) / 100, Number(iy!.value) / 100]
      registry.setTravel(slug, next)
      // keep the overlay ellipse in step with the value being tuned
      for (const eye of document.querySelectorAll<HTMLElement>(`.eye[data-style="${slug}"]`)) {
        eye.style.setProperty('--travel-x', String(next[0]))
        eye.style.setProperty('--travel-y', String(next[1]))
      }
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
        return `  ${slug}: [${(x * 100).toFixed(1)}, ${(y * 100).toFixed(1)}],`
      })
      .join('\n')
    const snippet = `const TRAVEL_OVERRIDES: Overrides = {\n${body}\n}`
    const button = e.currentTarget as HTMLButtonElement
    try {
      await navigator.clipboard.writeText(snippet)
      button.textContent = '已複製 ✓'
    } catch {
      // clipboard needs a secure context; the console always works
      console.log(snippet)
      button.textContent = '已輸出到 console'
    }
    setTimeout(() => (button.textContent = '複製 TRAVEL_OVERRIDES'), 1600)
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
