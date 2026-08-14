/**
 * Where a point in the camera frame lands on screen.
 *
 * The camera fills the viewport with `object-fit: cover`, so the frame is
 * scaled up until both axes are covered and the overflow is centre-cropped —
 * this reproduces that transform for a normalised point.
 *
 * `mirrored` matches the CSS `scaleX(-1)` on the video: with it, someone
 * standing to their own left appears on the left of the screen, so the eyes
 * turn towards where the person actually is rather than their reflection.
 *
 * Checked by mapping.selftest.ts.
 */
export function faceToScreen(
  nx: number,
  ny: number,
  videoW: number,
  videoH: number,
  viewW: number,
  viewH: number,
  mirrored = true,
): [number, number] {
  const scale = Math.max(viewW / videoW, viewH / videoH)
  const shownW = videoW * scale
  const shownH = videoH * scale
  const x = (viewW - shownW) / 2 + (mirrored ? 1 - nx : nx) * shownW
  const y = (viewH - shownH) / 2 + ny * shownH
  return [x, y]
}
