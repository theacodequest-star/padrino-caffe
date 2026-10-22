import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { endOtherSessions, signInWithGoogle } from '../lib/auth'

export function Login() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (!error) await endOtherSessions()
    setBusy(false)
    if (error) setError(/banned/i.test(error.message) ? t('bannedEmail') : t('loginFailed'))
    else navigate('/', { replace: true })
  }

  return (
    <Page title={t('loginTitle')}>
      <form onSubmit={submit}>
        <Field label={t('email')} name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Field label={t('password')} name="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" disabled={busy}>{t('login')}</button>
        <p className="or">—</p>
        <button type="button" className="btn btn-ghost" onClick={() => signInWithGoogle()}>{t('google')}</button>
        <p className="center">{t('noAccount')} <Link to="/signup">{t('join')}</Link></p>
      </form>
    </Page>
  )
}
