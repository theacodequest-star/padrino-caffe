import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

// Google and email-confirmation links land here; the Supabase client finishes the sign-in from the URL.
export function AuthCallback() {
  const { session, loading } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => navigate(session ? '/' : '/login', { replace: true }), session ? 0 : 4000)
    return () => clearTimeout(timer)
  }, [session, loading, navigate])

  return <div className="page"><p className="spinner">{t('signingIn')}</p></div>
}
