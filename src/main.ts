import { buildColumns } from './layout/columns'
import { startDrift, type Drift } from './layout/drift'
import { startScroll } from './layout/scroll'
import { createRegistry } from './eyes/registry'
import { startKiosk } from './system/kiosk'
import './styles/global.css'

/** Where the four columns start drifting instead of the page scrolling. */
const DESKTOP = '(min-width: 1280px)'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('missing #app')

const { root: feed, columns } = buildColumns()
app.append(feed)

startKiosk()
// before the registry, so its rAF runs first and the eyes read a settled
// position rather than last frame's
startScroll()

const registry = createRegistry(feed)
registry.addAll(feed)
registry.start()

// The desktop columns move by transform, which the registry cannot see from a
// cached rect — it reads their live offsets instead.
const desktop = matchMedia(DESKTOP)
let drift: Drift | null = null
const applyLayout = () => {
  drift?.destroy()
  drift = desktop.matches ? startDrift(feed, columns) : null
  registry.useColumnOffsets(drift?.offsets ?? [])
}
applyLayout()
desktop.addEventListener('change', applyLayout)
// A resize that crosses the breakpoint while the module is still evaluating
// never reaches the listener above, so re-check the mode here as well.
new ResizeObserver(() => {
  if (desktop.matches !== (drift !== null)) applyLayout()
  else drift?.remeasure()
}).observe(feed)

// The pointer drives the eyes until the camera is ready, and stays in charge
// if the camera never arrives — an expo screen must never sit dead.
const onPointer = (e: PointerEvent) => registry.setTarget(e.clientX, e.clientY)
addEventListener('pointermove', onPointer, { passive: true })

const tracker = await import('./face/track')
  .then(({ startFaceTracking }) => startFaceTracking(registry))
  .then((t) => {
    removeEventListener('pointermove', onPointer)
    registry.releaseTarget()
    return t
  })
  .catch((err: unknown) => {
    console.warn('face tracking unavailable, following the pointer instead', err)
    return null
  })

if (new URLSearchParams(location.search).has('debug')) {
  const { mountDebugPanel } = await import('./debug/panel')
  mountDebugPanel(registry, tracker)
  // handles for poking at a live install from the console
  Object.assign(window, { eyes: registry, tracker })
}
