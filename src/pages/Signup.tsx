import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { NicknameField, type NickState } from './NicknameField'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { maxBirthYear } from '../lib/auth'

export function Signup() {
  const { t } = useI18n()
  const [form, setForm] = useState({ fullName: '', nickname: '', birthYear: '', email: '', password: '' })
  const [nick, setNick] = useState<NickState>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const year = Number(form.birthYear)
  const tooYoung = form.birthYear.length === 4 && year > maxBirthYear()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (nick === 'taken' || tooYoung) return
    if (form.password.length < 6) { setError(t('passwordShort')); return }
    setBusy(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { name: form.fullName.trim(), full_name: form.fullName.trim(), nickname: form.nickname.trim(), birth_year: year },
      },
    })
    setBusy(false)
    if (error) setError(/banned/i.test(error.message) ? t('bannedEmail') : /nickname/i.test(error.message) ? t('nicknameTaken') : t('error'))
    else setDone(true)
  }

  if (done) return (
    <Page title={t('signupTitle')}>
      <p className="center">{t('signupDone')}</p>
      <Link to="/login" className="btn">{t('login')}</Link>
    </Page>
  )

  return (
    <Page title={t('signupTitle')}>
      <form onSubmit={submit} noValidate={false}>
        <Field label={t('fullName')} name="fullName" required autoComplete="name" value={form.fullName} onChange={e => set('fullName')(e.target.value)} />
        <NicknameField value={form.nickname} onChange={set('nickname')} onState={setNick} />
        <Field
          label={t('birthYear')} name="birthYear" required inputMode="numeric" pattern="\d{4}" maxLength={4}
          min={1900} max={maxBirthYear()} value={form.birthYear}
          onChange={e => set('birthYear')(e.target.value.replace(/\D/g, ''))}
          error={tooYoung ? t('tooYoung') : undefined}
        />
        <Field label={t('email')} name="email" type="email" required autoComplete="email" value={form.email} onChange={e => set('email')(e.target.value)} />
        <Field
          label={t('password')} name="password" type="password" required minLength={6} autoComplete="new-password"
          value={form.password} onChange={e => set('password')(e.target.value)} hint={t('passwordShort')}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" disabled={busy || nick === 'taken' || nick === 'checking' || tooYoung}>{t('join')}</button>
        <p className="center">{t('haveAccount')} <Link to="/login">{t('login')}</Link></p>
      </form>
    </Page>
  )
}
