import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import { useAuth, isStaff } from './auth'
import { useI18n } from './i18n'
import { load, save } from './storage'

// Staff hear a chime and feel a buzz whenever any waiter confirms a new order, on every screen of the
// app, as long as it is open. The waiter who scanned the order is not alerted for their own scan.
// Browsers only allow sound after the first tap on the page, so the audio is unlocked then.
const SOUND_KEY = 'padrino.orderSound'
let ctx: AudioContext | null = null

const unlock = () => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* no Web Audio */ }
}

export const soundOn = () => load(SOUND_KEY) !== 'off'
export const setSoundOn = (on: boolean) => save(SOUND_KEY, on ? 'on' : 'off')

// Two rising bell tones, made in the browser so there is no sound file to load.
export function chime() {
  unlock()
  if (!ctx) return
  const now = ctx.currentTime
  for (const [freq, at] of [[880, 0], [1320, 0.18]] as const) {
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + at)
    gain.gain.exponentialRampToValueAtTime(0.5, now + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + at)
    osc.stop(now + at + 0.65)
  }
}

export function alertNewOrder() {
  if (soundOn()) chime()
  try { navigator.vibrate?.([250, 120, 250]) } catch { /* not supported, e.g. iPhone */ }
}

export function OrderAlerts() {
  const { t } = useI18n()
  const { profile, session } = useAuth()
  const [count, setCount] = useState(0)
  const staff = isStaff(profile?.role)
  const me = session?.user.id ?? null

  useEffect(() => {
    if (!staff) return
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    const seen = new Set<string>()
    const stop = api.watchNewOrders((id, confirmedBy) => {
      if (seen.has(id) || (confirmedBy && confirmedBy === me)) return
      seen.add(id)
      alertNewOrder()
      setCount(n => n + 1)
    })
    return () => {
      stop()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [staff, me])

  if (!count) return null
  return (
    <div className="order-toast" role="status">
      <Link to="/orders" onClick={() => setCount(0)}>🔔 {count === 1 ? t('newOrderToast') : t('newOrdersToast', { n: count })}</Link>
      <button type="button" className="order-toast-close" aria-label={t('close')} onClick={() => setCount(0)}>×</button>
    </div>
  )
}
