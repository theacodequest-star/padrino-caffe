import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { InstallButton } from '../components/InstallButton'
import { useI18n } from '../lib/i18n'
import { clearSignedOutElsewhere, wasSignedOutElsewhere } from '../lib/auth'

export function Welcome() {
  const { t } = useI18n()
  const [kicked] = useState(wasSignedOutElsewhere)
  useEffect(clearSignedOutElsewhere, [])
  return (
    <div className="page welcome">
      <div className="welcome-top">
        <Logo />
        <h1 className="welcome-name"><span className="welcome-caffe">CAFFE</span>PADRINO</h1>
        <p className="welcome-city">PARAĆIN</p>
        <div className="ornament" aria-hidden="true"><span>◆</span></div>
        <p className="tagline">„{t('tagline')}“</p>
      </div>
      {kicked && <p className="notice" role="status">{t('signedOutElsewhere')}</p>}
      <div className="stack">
        <Link to="/signup" className="btn">{t('join')}</Link>
        <Link to="/login" className="btn btn-ghost">{t('login')}</Link>
        <InstallButton />
      </div>
    </div>
  )
}
