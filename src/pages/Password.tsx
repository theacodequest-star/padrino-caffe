import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'

// Sends a link that signs the person in and opens NewPassword.
export function ForgotPassword() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=new-password`,
    })
    setState(error ? 'error' : 'sent')
  }

  return (
    <Page title={t('forgotTitle')}>
      {state === 'sent' ? (
        <>
          <p className="center">{t('resetSent', { e: email.trim() })}</p>
          <p className="center"><Link to="/login">{t('login')}</Link></p>
        </>
      ) : (
        <form onSubmit={submit}>
          <p>{t('forgotIntro')}</p>
          <Field label={t('email')} name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          {state === 'error' && <p className="form-error">{t('error')}</p>}
          <button className="btn" disabled={state === 'busy'}>{t('sendLink')}</button>
        </form>
      )}
    </Page>
  )
}

export function NewPassword() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError(t('passwordShort'))
    if (password !== repeat) return setError(t('passwordMismatch'))
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(t('error'))
    else navigate('/', { replace: true })
  }

  return (
    <Page title={t('newPasswordTitle')} back={false}>
      <form onSubmit={submit}>
        <Field label={t('newPassword')} name="password" type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        <Field label={t('repeatPassword')} name="repeat" type="password" required autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" disabled={busy}>{t('savePassword')}</button>
      </form>
    </Page>
  )
}
