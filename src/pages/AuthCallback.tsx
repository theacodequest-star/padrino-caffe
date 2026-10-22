import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { endOtherSessions, useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

// Email confirmation and password-reset links land here; the Supabase client finishes the sign-in from the URL.
// If Supabase refused (an expired link, say), the reason comes back in the address, and we show it instead of waiting.
export function AuthCallback() {
  const { session, loading } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [failure] = useState(() => {
    const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
    return params.get('error_description') ?? params.get('error')
  })

  useEffect(() => {
    if (loading || failure) return
    if (session) {
      // A new login takes over the account: other devices get signed out.
      const next = new URLSearchParams(window.location.search).get('next') === 'new-password' ? '/new-password' : '/'
      endOtherSessions().finally(() => navigate(next, { replace: true }))
      return
    }
    const timer = setTimeout(() => navigate('/login', { replace: true }), 6000)
    return () => clearTimeout(timer)
  }, [session, loading, failure, navigate])

  if (failure) return (
    <div className="page">
      <h1 className="title">{t('loginFailedTitle')}</h1>
      <p className="form-error center">{failure}</p>
      <p className="center"><Link to="/login">{t('tryAgain')}</Link></p>
    </div>
  )
  return <div className="page"><p className="spinner">{t('signingIn')}</p></div>
}
