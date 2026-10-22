import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { Cz } from '../components/Cz'
import { Loading } from '../components/Loading'
import { Qr } from '../components/Qr'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n, type StringKey } from '../lib/i18n'
import { BADGES, pick, pointsWord, rankFor, TITLES } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

export function Points() {
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const data = useLoad(async () => {
    const [stats, rewards, history] = await Promise.all([api.myStats(), api.rewards(), api.pointHistory()])
    return { stats, rewards, history }
  })

  if (!data.data || !profile) return <Page title={t('myPoints')}><Loading error={data.error} /></Page>
  const { stats, rewards, history } = data.data
  const { current, next } = rankFor(stats.lifetime)
  const progress = next ? (stats.lifetime - current.min) / (next.min - current.min) : 1
  const title = stats.all_time_place && stats.all_time_place <= 3 ? TITLES[stats.all_time_place - 1] : null
  const earned = BADGES.filter(b => b.earned(stats))
  const dateFmt = new Intl.DateTimeFormat(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Page title={t('myPoints')}>
      <div className="card balance">
        <span className="field-label">{t('balance')}</span>
        <span className="balance-num">{stats.balance}</span>
        <span className="muted">{pointsWord(stats.balance, lang)}</span>
      </div>

      <div className="card rank">
        <div className="rank-head">
          <span className="field-label">{t('rank')}</span>
          <strong className="rank-name"><Cz>{current.name}</Cz>{title && <> · <Cz>{title}</Cz></>}</strong>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="muted">{next ? t('toNextRank', { n: next.min - stats.lifetime, r: next.name }) : t('topRank')}</p>
      </div>

      <div className="card member">
        <h2 className="section-title"><Cz>{t('memberCard')}</Cz></h2>
        <Qr value={`padrino:member:${profile.id}`} label={t('memberCard')} size={200} />
        <p className="member-nick">{profile.nickname}</p>
        <p className="muted center">{t('memberCardHint')}</p>
      </div>

      <h2 className="section-title"><Cz>{t('rewards')}</Cz></h2>
      <ul className="list">
        {rewards.map(r => {
          const missing = r.cost - stats.balance
          return (
            <li key={r.id} className="list-row">
              <span>{pick(r, 'name', lang)}<br /><span className="muted">{r.cost} {pointsWord(r.cost, lang)}</span></span>
              {missing <= 0
                ? <span className="tag tag-ok">{t('canTake')}</span>
                : <span className="tag">{t('missing', { n: missing })}</span>}
            </li>
          )
        })}
      </ul>

      <h2 className="section-title"><Cz>{`${t('badges')} ${earned.length}/${BADGES.length}`}</Cz></h2>
      <ul className="badges">
        {BADGES.map(b => {
          const on = earned.includes(b)
          return (
            <li key={b.key} className={on ? 'on' : ''}>
              <span className="badge-icon" aria-hidden="true">{on ? '★' : '☆'}</span>
              <strong>{b.name}</strong>
              <span>{lang === 'sr' ? b.sr : b.en}</span>
            </li>
          )
        })}
      </ul>

      <Link to="/leaderboard" className="btn btn-ghost" style={{ marginTop: 20 }}>{t('leaderboard')}</Link>

      <h2 className="section-title"><Cz>{t('history')}</Cz></h2>
      {history.length === 0 ? <p className="muted">{t('noHistory')}</p> : (
        <ul className="list">
          {history.map(h => (
            <li key={h.id} className="list-row">
              <span>{(lang === 'en' ? h.reward_name_en : h.reward_name_sr) || t(`reason_${h.reason}` as StringKey) || h.reason}<br /><span className="muted">{dateFmt.format(new Date(h.created_at))}</span></span>
              <strong className={h.points > 0 ? 'plus' : 'minus'}>{h.points > 0 ? `+${h.points}` : h.points}</strong>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
