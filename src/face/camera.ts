import './camera.css'

/** Small frames are plenty for face detection and keep the decode cheap. */
const IDEAL = { width: 640, height: 480 }

/**
 * Opens the front camera and mounts it as the page background.
 * Rejects if there is no camera or the user declines — callers must handle
 * that and fall back, since an expo screen may never show a black hole.
 */
export async function startCamera(): Promise<HTMLVideoElement> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable')

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: IDEAL.width }, height: { ideal: IDEAL.height } },
    audio: false,
  })

  const video = document.createElement('video')
  video.className = 'camera'
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.srcObject = stream

  // videoWidth is 0 until metadata lands, and the mapping needs it
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('camera stream failed')), { once: true })
  })
  await video.play()

  document.body.prepend(video)
  return video
}
