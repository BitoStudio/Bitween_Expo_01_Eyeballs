import type { Registry } from '../eyes/registry'
import { startCamera } from './camera'
import { createDetector, type FacePoint } from './detector'
import { faceToScreen } from './mapping'

/** Detection rate. The registry interpolates between these to 60fps. */
const DETECT_HZ = 15
/** How long a face may be missing before the eyes look away. */
const LOST_AFTER_MS = 2000

export type FaceTracker = {
  stop(): void
  /** Latest state, for the debug panel. */
  status(): { face: FacePoint | null; screen: [number, number] | null; fps: number }
}

/**
 * Points the eyes at whoever is in front of the camera.
 * Throws if the camera is unavailable or refused — the caller keeps its
 * fallback target source in that case.
 */
export async function startFaceTracking(registry: Registry): Promise<FaceTracker> {
  const video = await startCamera()
  const detector = await createDetector()

  let raf = 0
  let lastRun = 0
  let lastSeen = 0
  let tracking = false
  let face: FacePoint | null = null
  let screen: [number, number] | null = null
  let ticks = 0
  let fps = 0
  let fpsSince = performance.now()

  const step = 1000 / DETECT_HZ

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (now - lastRun < step) return
    lastRun = now

    face = detector.detect(video, now)
    ticks++
    if (now - fpsSince >= 1000) {
      fps = Math.round((ticks * 1000) / (now - fpsSince))
      ticks = 0
      fpsSince = now
    }

    if (face) {
      screen = faceToScreen(
        face.nx,
        face.ny,
        video.videoWidth,
        video.videoHeight,
        window.innerWidth,
        window.innerHeight,
      )
      // reappearing somewhere new: jump the target, the gain ramp hides it
      if (tracking) registry.setTarget(screen[0], screen[1])
      else registry.snapTo(screen[0], screen[1])
      tracking = true
      lastSeen = now
    } else if (tracking && now - lastSeen > LOST_AFTER_MS) {
      tracking = false
      screen = null
      registry.releaseTarget()
    }
  }

  raf = requestAnimationFrame(loop)

  // rAF stops while the tab is hidden, which parks the detector for free — but
  // the stream can come back paused, and a paused frame detects nothing.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && video.paused) {
      video.play().catch((err) => console.warn('camera did not resume', err))
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  return {
    stop() {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisible)
      detector.close()
      for (const track of (video.srcObject as MediaStream | null)?.getTracks() ?? []) track.stop()
      video.remove()
    },
    status: () => ({ face, screen, fps }),
  }
}
