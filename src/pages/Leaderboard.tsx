import { useState } from 'react'
import { Page } from '../components/Page'
import { Loading } from '../components/Loading'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { pointsWord, TITLES } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function Leaderboard() {
  const { t, lang } = useI18n()
  const { profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState<'all' | 'month'>('all')
  const [month, setMonth] = useState(thisMonth())
  const rows = useLoad(() => api.leaderboard(mode === 'month' ? month : null), [mode, month])
  const hidden = !!profile?.hide_from_leaderboard

  const toggleHidden = async () => {
    if (!profile) return
    await api.setHideFromLeaderboard(!hidden, profile.id)
    await refreshProfile()
    rows.reload()
  }

  return (
    <Page title={t('leaderboard')}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'all'} className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>{t('allTime')}</button>
        <button role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>{t('byMonth')}</button>
      </div>
      {mode === 'month' && (
        <label className="field">
          <input type="month" value={month} max={thisMonth()} onChange={e => setMonth(e.target.value || thisMonth())} aria-label={t('byMonth')} />
        </label>
      )}

      {!rows.data ? <Loading error={rows.error} /> : rows.data.length === 0 ? <p className="muted center">{t('nobodyYet')}</p> : (
        <ol className="leader">
          {rows.data.map((r, i) => (
            <li key={r.user_id} className={r.user_id === profile?.id ? 'me' : ''}>
              <span className="leader-place">{i + 1}</span>
              <span className="leader-name">
                {r.nickname}{r.user_id === profile?.id && <span className="muted"> ({t('you')})</span>}
                {mode === 'all' && i < 3 && <span className="leader-title">{TITLES[i]}</span>}
              </span>
              <span className="leader-pts">{r.points} <span className="muted">{pointsWord(r.points, lang)}</span></span>
            </li>
          ))}
        </ol>
      )}

      <label className="toggle">
        <input type="checkbox" checked={hidden} onChange={toggleHidden} />
        <span>{t('hideMe')}</span>
      </label>
    </Page>
  )
}
