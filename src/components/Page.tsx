import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

export function Page({ title, back = true, children }: { title?: string; back?: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  // Opened directly or from a shared link: there is no history entry of ours to go back to.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }))
  return (
    <div className="page">
      {back && <button className="back" onClick={goBack} aria-label={t('back')}>‹ {t('back')}</button>}
      {title && <h1 className="title">{title}</h1>}
      {children}
    </div>
  )
}
