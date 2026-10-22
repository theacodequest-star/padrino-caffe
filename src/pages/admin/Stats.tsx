import { useState } from 'react'
import { Page } from '../../components/Page'
import { Loading } from '../../components/Loading'
import { api } from '../../lib/api'
import { useI18n, type StringKey } from '../../lib/i18n'
import { pick, rsd } from '../../lib/guest'
import { useLoad } from '../../lib/useLoad'
import { useAuth } from '../../lib/auth'
import { useDialog } from '../../components/Dialog'

type Period = 'today' | '7' | '30' | '90' | 'day'
const PERIODS: Period[] = ['today', '7', '30', '90', 'day']
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function range(p: Period, day: string): [string, string] {
  const today = new Date()
  if (p === 'today') return [iso(today), iso(today)]
  if (p === 'day') return [day, day]
  return [iso(new Date(today.getTime() - (Number(p) - 1) * 864e5)), iso(today)]
}

export function Stats() {
  const { t, lang } = useI18n()
  const [period, setPeriod] = useState<Period>('7')
  const [day, setDay] = useState(iso(new Date()))
  const [from, to] = range(period, day)
  const stats = useLoad(() => api.stats(from, to), [from, to])
  const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-GB'

  const tiles: [StringKey, string][] = stats.data ? [
    ['s_orders', String(stats.data.orders)],
    ['s_avg', rsd(stats.data.avg_bill)],
    ['s_guests', String(stats.data.guests)],
    ['s_new', String(stats.data.new_members)],
    ['s_points', String(stats.data.points_given)],
    ['s_rewards', String(stats.data.rewards_used)],
    ['s_rejected', String(stats.data.rejected)],
  ] : []

  const busiest = stats.data?.by_hour.reduce((a, b) => (b.orders > a.orders ? b : a), { hour: -1, orders: 0 })

  return (
    <Page title={t('statistics')}>
      <div className="filters" role="tablist">
        {PERIODS.map(p => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
            {t(`p_${p}` as StringKey)}
          </button>
        ))}
      </div>
      {period === 'day' && (
        <input type="date" value={day} max={iso(new Date())} onChange={e => setDay(e.target.value || iso(new Date()))} aria-label={t('p_day')} style={{ marginTop: 8 }} />
      )}

      {!stats.data ? <Loading error={stats.error} /> : (
        <>
          <div className="card hero">
            <span className="field-label">{t('revenue')}</span>
            <span className="hero-num">{rsd(stats.data.revenue)}</span>
            <span className="muted">{t('revenueNote')}</span>
          </div>
          <div className="stat-tiles">
            {tiles.map(([k, v]) => <div key={k} className="stat-tile"><span className="stat-val">{v}</span><span className="stat-label">{t(k)}</span></div>)}
          </div>

          {stats.data.by_day.length > 1 && (
            <BarChart title={t('revenueByDay')} data={dayBars(stats.data.by_day, locale)} />
          )}
          <BarChart
            title={t('ordersByHour')}
            note={busiest && busiest.hour >= 0 ? t('busiestHour', { h: `${busiest.hour}:00–${busiest.hour + 1}:00` }) : undefined}
            data={stats.data.by_hour.map(h => ({ key: String(h.hour), label: `${h.hour}h`, axis: String(h.hour), value: h.orders, display: String(h.orders) }))}
            highlight={busiest ? String(busiest.hour) : undefined}
          />

          <h2 className="section-title">{t('topSelling')}</h2>
          {stats.data.top_selling.length === 0 ? <p className="muted">{t('noData')}</p> : (
            <ol className="rank-list">
              {stats.data.top_selling.map(i => (
                <li key={i.item_id}>
                  <span className="rank-list-name">{pick(i, 'name', lang)}</span>
                  <span className="muted">{i.qty} {t('pcs')}</span>
                  <strong>{rsd(i.revenue)}</strong>
                </li>
              ))}
            </ol>
          )}
          <h2 className="section-title">{t('topRated')}</h2>
          {stats.data.top_rated.length === 0 ? <p className="muted">{t('noData')}</p> : (
            <ol className="rank-list">
              {stats.data.top_rated.map(i => (
                <li key={i.item_id}>
                  <span className="rank-list-name">{pick(i, 'name', lang)}</span>
                  <span className="muted">{i.count}×</span>
                  <strong>★ {i.avg.toFixed(1)}</strong>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <ClearTestData onCleared={stats.reload} />
    </Page>
  )
}

type Bar = { key: string; label: string; axis?: string; value: number; display: string }

// Up to a month is shown day by day; longer periods are summed per week so columns stay tappable on a phone.
function dayBars(days: { day: string; revenue: number }[], locale: string): Bar[] {
  const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' })
  // Axis labels stay narrow enough to sit under their column on a 320px phone; the readout shows the full date.
  const tight = (d: string) => { const [, m, day] = d.split('-').map(Number); return `${day}.${m}.` }
  if (days.length <= 31) return days.map(d => ({ key: d.day, label: short(d.day), axis: String(Number(d.day.slice(8))), value: d.revenue, display: rsd(d.revenue) }))
  const weeks: Bar[] = []
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7)
    const sum = chunk.reduce((s, d) => s + d.revenue, 0)
    weeks.push({ key: chunk[0].day, label: short(chunk[0].day), axis: tight(chunk[0].day), value: sum, display: `${short(chunk[0].day)}–${short(chunk[chunk.length - 1].day)}: ${rsd(sum)}` })
  }
  return weeks
}

// Single-series column chart: no legend (the title names it), tap or hover a column for its exact value.
function BarChart({ title, note, data, highlight }: { title: string; note?: string; data: Bar[]; highlight?: string }) {
  const { t } = useI18n()
  const [active, setActive] = useState<string | null>(null)
  const [table, setTable] = useState(false)
  const max = Math.max(1, ...data.map(d => d.value))
  const labelEvery = Math.ceil(data.length / 6)
  const shown = data.find(d => d.key === active)

  return (
    <figure className="card chart">
      <figcaption className="chart-head">
        <h2 className="section-title">{title}</h2>
        <span className="chart-readout" aria-live="polite">{shown ? `${shown.label}: ${shown.display}` : t('tapColumn')}</span>
      </figcaption>
      {note && <p className="chart-note">{note}</p>}
      {table ? (
        <table className="chart-table">
          <tbody>{data.map(d => <tr key={d.key}><td>{d.label}</td><td>{d.display}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="bars" onMouseLeave={() => setActive(null)}>
          {data.map((d, i) => (
            <button
              key={d.key}
              className={`bar-hit ${active === d.key ? 'on' : ''} ${highlight === d.key ? 'peak' : ''}`}
              onMouseEnter={() => setActive(d.key)}
              onFocus={() => setActive(d.key)}
              onClick={() => setActive(active === d.key ? null : d.key)}
              aria-label={`${d.label}: ${d.display}`}
            >
              <span className="bar" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
              <span className="bar-label">{i % labelEvery === 0 ? d.axis ?? d.label : ''}</span>
            </button>
          ))}
        </div>
      )}
      <button className="link-btn" onClick={() => setTable(v => !v)}>{table ? title : t('showTable')}</button>
    </figure>
  )
}

// Only the owner account sees this. Two confirmations, because deleted data can't come back.
function ClearTestData({ onCleared }: { onCleared: () => void }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  if (profile?.role !== 'owner') return null

  const run = async () => {
    setBusy(true)
    try {
      const c = await api.testDataCounts()
      if (!c.orders && !c.points && !c.ratings && !c.reviews) { await dialog({ message: t('clearTestNothing') }); return }
      const msg = t('clearTestConfirm', { o: c.orders, p: c.points, r: c.ratings, w: c.reviews })
      if (!await dialog({ message: msg, confirm: true, danger: true, okLabel: t('clearTestButton') })) return
      if (!await dialog({ message: t('clearTestFinal'), confirm: true, danger: true, okLabel: t('clearTestButton') })) return
      await api.clearTestData()
      onCleared()
      await dialog({ message: t('clearTestDone') })
    } catch {
      await dialog({ message: t('error') })
    } finally { setBusy(false) }
  }

  return (
    <div className="card danger-zone">
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('clearTestTitle')}</h2>
      <p className="muted">{t('clearTestIntro')}</p>
      <button type="button" className="btn btn-danger" disabled={busy} onClick={run}>{t('clearTestButton')}</button>
    </div>
  )
}
