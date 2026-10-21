import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'

export function Header() {
  const { lang, setLang, t } = useI18n()
  const { theme, toggle } = useTheme()
  return (
    <header className="header">
      <Link to="/" className="header-brand">CAFFE PADRINO</Link>
      <div className="header-switches">
        <button className="switch" onClick={toggle} aria-label={t('themeToggle')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
        <button className="switch" onClick={() => setLang(lang === 'sr' ? 'en' : 'sr')} aria-label={t('langToggle')}>
          {lang === 'sr' ? 'EN' : 'SR'}
        </button>
      </div>
    </header>
  )
}

const Sun = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
  </svg>
)

const Moon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
  </svg>
)
