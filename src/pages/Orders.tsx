import { useEffect, useState } from 'react'
import { Page } from '../components/Page'
import { Loading } from '../components/Loading'
import { api, type OrderStatus, type StaffOrder } from '../lib/api'
import { useI18n, type StringKey } from '../lib/i18n'
import { pick, rsd } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

type Filter = 'active' | 'new' | 'preparing' | 'ready' | 'delivered'
const FILTERS: Filter[] = ['active', 'new', 'preparing', 'ready', 'delivered']
const ACTIVE: OrderStatus[] = ['new', 'preparing', 'ready']
const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const matches = (o: StaffOrder, f: Filter) => (f === 'active' ? ACTIVE.includes(o.status) : o.status === f)

export function Orders() {
  const { t } = useI18n()
  const [day, setDay] = useState(localDay())
  const [filter, setFilter] = useState<Filter>('active')
  const orders = useLoad(() => api.ordersForDay(day), [day])
  const [, tick] = useState(0)

  useEffect(() => api.watchOrders(() => orders.reload()), [day]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keeps "minutes since confirmation" fresh.
  useEffect(() => { const i = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(i) }, [])

  const list = orders.data ?? []
  const shown = list.filter(o => matches(o, filter))

  const advance = async (o: StaffOrder) => {
    try { await api.advanceOrder(o) } finally { orders.reload() }
  }

  return (
    <Page title={t('orders')}>
      <div className="orders-bar">
        <input type="date" value={day} max={localDay()} onChange={e => setDay(e.target.value || localDay())} aria-label={t('today')} />
        {day !== localDay() && <button className="btn btn-ghost btn-small" onClick={() => setDay(localDay())}>{t('today')}</button>}
      </div>
      <div className="filters" role="tablist">
        {FILTERS.map(f => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'active' ? t('f_active') : t(`st_${f}` as StringKey)} <span className="count">{list.filter(o => matches(o, f)).length}</span>
          </button>
        ))}
      </div>

      {!orders.data ? <Loading error={orders.error} /> : shown.length === 0 ? <p className="muted center">{t('noOrders')}</p> : (
        <ul className="order-cards">
          {shown.map(o => <OrderCard key={o.id} order={o} onAdvance={() => advance(o)} />)}
        </ul>
      )}
    </Page>
  )
}

function OrderCard({ order: o, onAdvance }: { order: StaffOrder; onAdvance: () => void }) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const mins = o.confirmed_at ? Math.max(0, Math.round((Date.now() - new Date(o.confirmed_at).getTime()) / 60000)) : null
  const canAdvance = ACTIVE.includes(o.status)
  return (
    <li className={`card order-card st-${o.status}`}>
      <div className="order-card-head">
        <span className="order-table">{t('table')} {o.table_number}</span>
        <span className={`status-chip st-${o.status}`}>{t(`st_${o.status}` as StringKey)}</span>
      </div>
      <p className="muted order-meta">{o.code}{mins !== null && ` · ${t('minutesAgo', { n: mins })}`}</p>
      <ul className="summary">
        {o.lines.map(l => <li key={l.item_id}><span><strong>{l.quantity} ×</strong> {pick(l, 'name', lang)}</span></li>)}
      </ul>
      {o.note && <p className="note">„{o.note}“</p>}
      <div className="cart-total"><span>{t('total')}</span><strong>{rsd(o.total)}</strong></div>
      {canAdvance && (
        <button className="btn" disabled={busy} style={{ marginTop: 12 }}
          onClick={async () => { setBusy(true); await onAdvance(); setBusy(false) }}>
          {t(`next_${o.status}` as StringKey)} ›
        </button>
      )}
    </li>
  )
}
