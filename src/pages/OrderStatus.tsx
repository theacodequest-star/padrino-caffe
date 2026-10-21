import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Page } from '../components/Page'
import { Cz } from '../components/Cz'
import { Loading } from '../components/Loading'
import { Qr } from '../components/Qr'
import { StarInput } from '../components/Stars'
import { useDialog } from '../components/Dialog'
import { api, type Order, type OrderStatus as Status } from '../lib/api'
import { useI18n, type StringKey } from '../lib/i18n'
import { pick, rsd } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

const EXPIRY_MS = 15 * 60 * 1000
const STEPS: Status[] = ['waiting', 'new', 'preparing', 'ready', 'delivered']

export function OrderStatus() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const dialog = useDialog()
  const order = useLoad(() => api.order(id), [id])

  useEffect(() => api.watchOrder(id, () => order.reload()), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!order.data) return <Page title={t('yourOrder')}><Loading error={order.error} /></Page>
  const o = order.data

  const cancel = async () => {
    if (!(await dialog({ message: t('cancelConfirm'), confirm: true, okLabel: t('cancelOrder'), danger: true }))) return
    try { await api.cancelOrder(o.id); navigate('/', { replace: true }) } catch { dialog({ message: t('error') }) }
  }

  const step = STEPS.indexOf(o.status)

  return (
    <Page title={t('yourOrder')}>
      <div className={`status-pill status-${o.status}`}><Cz>{t(`st_${o.status}` as StringKey)}</Cz></div>

      {step >= 0 && (
        <ol className="steps" aria-label={t('yourOrder')}>
          {STEPS.map((s, i) => <li key={s} className={i <= step ? 'done' : ''}><span>{t(`st_${s}` as StringKey)}</span></li>)}
        </ol>
      )}

      {o.status === 'waiting' ? (
        <div className="order-qr">
          <Qr value={`padrino:order:${o.code}`} label={`${t('orderCode')} ${o.code}`} size={260} />
          <p className="field-label">{t('orderCode')}</p>
          <p className="order-code">{o.code}</p>
          <p className="center">{t('showWaiter')}</p>
          <Countdown from={o.created_at} onEnd={() => order.reload()} />
          <button className="btn btn-ghost" onClick={cancel}>{t('cancelOrder')}</button>
        </div>
      ) : (
        <p className="center status-text">{t(`stx_${o.status}` as StringKey)}</p>
      )}

      {o.status === 'expired' && <Link to="/menu" className="btn">{t('sendAgain')}</Link>}

      <OrderSummary order={o} />

      {o.status === 'delivered' && <ReviewForm order={o} />}

      <p className="muted center" style={{ marginTop: 16 }}>{t('tableNumber')}: {o.table_number}{o.note ? ` · ${o.note}` : ''}</p>
    </Page>
  )
}

function Countdown({ from, onEnd }: { from: string; onEnd: () => void }) {
  const { t } = useI18n()
  const end = new Date(from).getTime() + EXPIRY_MS
  const [left, setLeft] = useState(end - Date.now())
  useEffect(() => {
    const timer = setInterval(() => {
      const l = end - Date.now()
      setLeft(l)
      if (l <= 0) { clearInterval(timer); onEnd() }
    }, 1000)
    return () => clearInterval(timer)
  }, [end, onEnd])
  const s = Math.max(0, Math.floor(left / 1000))
  return <p className="muted center">{t('expiresIn', { t: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })}</p>
}

function OrderSummary({ order }: { order: Order }) {
  const { t, lang } = useI18n()
  return (
    <div className="card">
      <ul className="summary">
        {order.lines.map(l => (
          <li key={l.item_id}><span>{l.quantity} × {pick(l, 'name', lang)}</span><span>{rsd(l.price * l.quantity)}</span></li>
        ))}
      </ul>
      <div className="cart-total"><span>{t('total')}</span><strong>{rsd(order.total)}</strong></div>
      <p className="cart-points">{t('pointsEarn', { n: order.points })}</p>
    </div>
  )
}

function ReviewForm({ order }: { order: Order }) {
  const { t, lang } = useI18n()
  const [drinks, setDrinks] = useState<Record<string, number>>({})
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const rateDrink = async (itemId: string, v: number) => {
    setDrinks(d => ({ ...d, [itemId]: v }))
    try { await api.rateItem(itemId, v) } catch { setState('error') }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stars) return
    setState('busy')
    try { await api.reviewWaiter(order.id, stars, comment.trim()); setState('done') } catch { setState('error') }
  }

  return (
    <div className="card">
      <h2 className="section-title"><Cz>{t('rateDrinks')}</Cz></h2>
      {order.lines.map(l => (
        <div key={l.item_id} className="rate-row">
          <span>{pick(l, 'name', lang)}</span>
          <StarInput value={drinks[l.item_id] ?? 0} onChange={v => rateDrink(l.item_id, v)} label={pick(l, 'name', lang)} />
        </div>
      ))}
      <h2 className="section-title"><Cz>{t('rateWaiter')}</Cz></h2>
      <form onSubmit={submit}>
        <StarInput value={stars} onChange={setStars} label={t('rateWaiter')} />
        <label className="field">
          <span className="field-label">{t('comment')}</span>
          <textarea maxLength={500} rows={3} value={comment} onChange={e => setComment(e.target.value)} />
          <span className="field-msg">{comment.length}/500</span>
        </label>
        {state === 'done' && <p className="field-ok">{t('thanksReview')}</p>}
        {state === 'error' && <p className="form-error">{t('error')}</p>}
        <button className="btn" disabled={!stars || state === 'busy'}>{t('send')}</button>
      </form>
    </div>
  )
}
