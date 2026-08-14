import { createRegistry } from './eyes/registry'
import { buildFeed } from './layout/feed'
import './styles/global.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('missing #app')

const feed = buildFeed()
app.append(feed)

const registry = createRegistry(feed)
registry.addAll(feed)
registry.start()

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
