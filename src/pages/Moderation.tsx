import { useEffect, useState, type FormEvent } from 'react'
import { Page } from '../components/Page'
import { Cz } from '../components/Cz'
import { Logo } from '../components/Logo'
import { NicknameField, type NickState } from './NicknameField'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'

// Full-screen page for a warned guest: nothing else works until the nickname is changed.
export function Warned() {
  const { t } = useI18n()
  const { profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [nick, setNick] = useState<NickState>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const deadline = new Date(profile?.warned_until ?? 0).getTime()
  const [left, setLeft] = useState(deadline - Date.now())

  useEffect(() => {
    const i = setInterval(() => {
      const l = deadline - Date.now()
      setLeft(l)
      if (l <= 0) { clearInterval(i); refreshProfile() }
    }, 1000)
    return () => clearInterval(i)
  }, [deadline, refreshProfile])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (nick !== 'free') return
    setBusy(true); setError('')
    try { await api.changeNickname(nickname.trim()); await refreshProfile() } catch { setError(t('error')) }
    setBusy(false)
  }

  const s = Math.max(0, Math.floor(left / 1000))
  const hms = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')

  return (
    <Page title={t('warnedTitle')} back={false}>
      <div className="alert-card warn">
        <p>{t('warnedText', { n: profile?.nickname ?? '' })}</p>
        <span className="field-label">{t('timeLeft')}</span>
        <span className="countdown" aria-live="off">{hms}</span>
        <p className="alert-risk">{t('warnedRisk')}</p>
      </div>
      <form onSubmit={submit}>
        <NicknameField value={nickname} onChange={setNickname} onState={setNick} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-big" disabled={busy || nick !== 'free'}>{t('changeNick')}</button>
      </form>
      <div className="logout"><button onClick={() => supabase.auth.signOut()}>{t('logout')}</button></div>
    </Page>
  )
}

export function Banned() {
  const { t } = useI18n()
  return (
    <Page back={false}>
      <div className="home-head" style={{ marginTop: 12 }}><Logo /></div>
      <h1 className="title" style={{ color: 'var(--danger)' }}><Cz>{t('bannedTitle')}</Cz></h1>
      <div className="alert-card ban"><p>{t('bannedText')}</p></div>
      <div className="logout"><button onClick={() => supabase.auth.signOut()}>{t('logout')}</button></div>
    </Page>
  )
}
