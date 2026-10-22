import { useState } from 'react'
import { Sheet } from './Sheet'
import { useInstall } from '../lib/install'
import { useI18n } from '../lib/i18n'

// Shown only where the app can be installed and isn't already running as the installed app.
export function InstallButton({ className = 'btn btn-ghost' }: { className?: string }) {
  const { t } = useI18n()
  const { mode, install } = useInstall()
  const [steps, setSteps] = useState(false)
  if (!mode) return null
  return (
    <>
      <button type="button" className={className} onClick={() => (mode === 'prompt' ? install() : setSteps(true))}>
        <DownloadIcon /> {t('installApp')}
      </button>
      {steps && (
        <Sheet onClose={() => setSteps(false)} label={t('installApp')}>
          <h2 className="section-title" style={{ marginTop: 0 }}>{t('installApp')}</h2>
          <ol className="install-steps">
            <li>{t('iosStep1')} <ShareIcon /></li>
            <li>{t('iosStep2')}</li>
            <li>{t('iosStep3')}</li>
          </ol>
          <button className="btn" onClick={() => setSteps(false)}>{t('ok')}</button>
        </Sheet>
      )}
    </>
  )
}

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" role="img" style={{ verticalAlign: '-3px' }}>
    <path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
)
