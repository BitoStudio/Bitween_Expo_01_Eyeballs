// Which blink clip in Assets/Blink belongs to which style. Shared by
// encode-blinks.mjs (clip -> sprite sheet) and prep-assets.mjs (sheet -> style).
//
// The clips are named after their colour, not their style. Two kinds:
//   lid    drawn on the eye's own canvas and laid over the whole eye — the
//          lid closes over the pupil. Checked against eye.png's size.
//   pupil  replaces the pupil itself and travels with the gaze; its first
//          frame is the resting pupil, held between blinks. Checked against
//          ball.png's size.
// bitostyle and fashion share one eye art, so they share one clip.
export const BLINKS = {
  bitostyle: { clip: 'orange pink_1.webm', mode: 'lid' },
  fashion: { clip: 'orange pink_1.webm', mode: 'lid' },
  girl: { clip: 'skin.webm', mode: 'lid' },
  simpson: { clip: 'yellow.webm', mode: 'lid' },
  sponge: { clip: 'yellow_eyelash.webm', mode: 'lid' },
  perry: { clip: 'blue.webm', mode: 'lid' },
  mike: { clip: 'green.webm', mode: 'lid' },
  cool: { clip: 'black.webm', mode: 'pupil' },
  doraemon: { clip: 'light_blue.webm', mode: 'pupil' },
}

/** Transparent border around every frame in a sheet, so a scaled-up frame
 *  never samples its neighbour's edge pixels. */
export const SHEET_GUTTER = 2
