/**
 * The things an unattended screen needs that a normal page does not.
 * Every one of these degrades quietly: a stand that shows something slightly
 * wrong beats a stand that shows a lock screen.
 */

export type Kiosk = { release(): void }

/**
 * Holds a screen wake lock for as long as the page is visible.
 *
 * The browser drops the lock whenever the tab hides, so it has to be taken
 * again on the way back — without that, one notification banner puts the
 * stand to sleep for the rest of the day.
 */
export function startKiosk(): Kiosk {
  let sentinel: WakeLockSentinel | null = null
  let stopped = false
  let warned = false

  const acquire = async () => {
    if (stopped || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch (err) {
      // refused on low battery, or unsupported — nothing to do but carry on.
      // Said once: this retries on every tab switch, all day.
      if (!warned) console.warn('wake lock unavailable, the screen may sleep', err)
      warned = true
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void acquire()
  }

  void acquire()
  document.addEventListener('visibilitychange', onVisible)

  return {
    release() {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
      sentinel = null
    },
  }
}
