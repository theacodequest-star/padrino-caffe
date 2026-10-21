import { useMemo, useState } from 'react'
import { Page } from '../../components/Page'
import { Loading } from '../../components/Loading'
import { Stars } from '../../components/Stars'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { ratingsWord } from '../../lib/guest'
import { useLoad } from '../../lib/useLoad'

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export function Reviews() {
  const { t, lang } = useI18n()
  const reviews = useLoad(() => api.waiterReviews())
  const [waiter, setWaiter] = useState('')
  const [guest, setGuest] = useState('')
  const [day, setDay] = useState('')
  const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-GB'

  const all = reviews.data ?? []
  const waiters = useMemo(() => {
    const m = new Map<string, { name: string; sum: number; n: number }>()
    for (const r of all) {
      const w = m.get(r.waiter_id) ?? { name: r.waiter_name, sum: 0, n: 0 }
      w.sum += r.stars; w.n++; m.set(r.waiter_id, w)
    }
    return [...m.entries()].map(([id, w]) => ({ id, name: w.name, avg: w.sum / w.n }))
  }, [all])

  const q = guest.trim().toLowerCase()
  const shown = all.filter(r =>
    (!waiter || r.waiter_id === waiter) &&
    (!q || [r.guest_name, r.guest_nickname].some(v => v?.toLowerCase().includes(q))) &&
    (!day || iso(new Date(r.created_at)) === day))
  const avg = shown.length ? shown.reduce((s, r) => s + r.stars, 0) / shown.length : 0

  return (
    <Page title={t('waiterReviews')}>
      <div className="review-filters">
        <label className="field">
          <span className="field-label">{t('waiter')}</span>
          <select value={waiter} onChange={e => setWaiter(e.target.value)}>
            <option value="">{t('allWaiters')}</option>
            {waiters.map(w => <option key={w.id} value={w.id}>{w.name} · ★ {w.avg.toFixed(1)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('guestSearch')}</span>
          <input type="search" value={guest} onChange={e => setGuest(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('date')}</span>
          <div className="orders-bar" style={{ margin: 0 }}>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} />
            {day && <button className="btn btn-ghost btn-small" onClick={() => setDay('')}>{t('allDays')}</button>}
          </div>
        </label>
      </div>

      {!reviews.data ? <Loading error={reviews.error} /> : (
        <>
          <div className="card review-summary">
            <span className="hero-num">{shown.length ? avg.toFixed(1) : '–'}</span>
            <Stars value={avg} size={20} />
            <span className="muted">{shown.length} {ratingsWord(shown.length, lang)}</span>
          </div>
          {shown.length === 0 ? <p className="muted center">{t('noReviews')}</p> : (
            <ul className="reviews">
              {shown.map(r => (
                <li key={r.id} className="card review">
                  <div className="review-head">
                    <Stars value={r.stars} />
                    <span className="muted">{new Date(r.created_at).toLocaleString(locale, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="review-waiter">{t('waiter')}: <strong>{r.waiter_name}</strong></p>
                  {r.comment && <p className="review-comment">„{r.comment}“</p>}
                  <p className="muted review-guest">{t('guest')}: {r.guest_name}{r.guest_nickname && ` („${r.guest_nickname}“)`}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  )
}
