import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { asset } from '../system/asset'

/** Both self-hosted by scripts/prep-assets.mjs — no CDN at the venue. */
const WASM_DIR = asset('wasm')
const MODEL = asset('models/blaze_face_short_range.tflite')

export type FacePoint = {
  /** Face centre, normalised to the camera frame. */
  nx: number
  ny: number
  /** Box area as a fraction of the frame — bigger means closer. */
  size: number
}

export type Detector = {
  detect(video: HTMLVideoElement, timestampMs: number): FacePoint | null
  close(): void
}

export async function createDetector(): Promise<Detector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_DIR)

  const open = (delegate: 'GPU' | 'CPU') =>
    FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    })

  let detector: FaceDetector
  try {
    detector = await open('GPU')
  } catch (err) {
    // some Android and older Safari builds have no usable WebGL for the delegate
    console.warn('face detector: GPU delegate unavailable, falling back to CPU', err)
    detector = await open('CPU')
  }

  return {
    detect(video, timestampMs) {
      const { detections } = detector.detectForVideo(video, timestampMs)
      const frameArea = video.videoWidth * video.videoHeight
      if (!frameArea) return null

      // biggest box wins: with a crowd, the eyes follow whoever is closest
      let best: FacePoint | null = null
      for (const { boundingBox: b } of detections) {
        if (!b) continue
        const size = (b.width * b.height) / frameArea
        if (best && size <= best.size) continue
        best = {
          nx: (b.originX + b.width / 2) / video.videoWidth,
          ny: (b.originY + b.height / 2) / video.videoHeight,
          size,
        }
      }
      return best
    },
    close: () => detector.close(),
  }
}
