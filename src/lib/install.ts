import { useEffect, useState } from 'react'

// Chrome, Edge and Samsung Internet fire beforeinstallprompt once the site is installable; keep it so a
// button can open the install dialog later. Safari on iPhone never fires it: there people use
// Share → Add to Home Screen, so the button shows those steps instead.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(l => l())

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferred = e as InstallEvent
  changed()
})
window.addEventListener('appinstalled', () => { deferred = null; changed() })

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export type InstallMode = 'prompt' | 'ios' | null

export function useInstall() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender(n => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  const mode: InstallMode = standalone() ? null : deferred ? 'prompt' : ios() ? 'ios' : null
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    changed()
  }
  return { mode, install }
}
