import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { Loading } from '../components/Loading'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { pick, RSD_PER_POINT, rsd, useCart } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

export function Cart() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { cart, setQty, clear } = useCart()
  const menu = useLoad(() => api.menu())
  const [table, setTable] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!menu.data) return <Page title={t('yourOrder')}><Loading error={menu.error} /></Page>

  const lines = menu.data.items.filter(i => cart[i.id] && i.available).map(i => ({ item: i, qty: cart[i.id] }))
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const points = Math.floor(total / RSD_PER_POINT)
  const toNext = RSD_PER_POINT - (total % RSD_PER_POINT)
  const tableNo = Number(table)
  const tableOk = Number.isInteger(tableNo) && tableNo >= 1 && tableNo <= 99

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tableOk || !lines.length) return
    setBusy(true); setError('')
    try {
      const order = await api.placeOrder(tableNo, note.trim(), lines.map(l => ({ item_id: l.item.id, quantity: l.qty })))
      clear()
      navigate(`/order/${order.id}`, { replace: true })
    } catch (err) {
      setError(/banned|warn/i.test((err as Error).message) ? t('cantOrder') : t('error'))
      setBusy(false)
    }
  }

  if (!lines.length) return (
    <Page title={t('yourOrder')}>
      <p className="center">{t('emptyOrder')}</p>
      <Link to="/menu" className="btn">{t('toMenu')}</Link>
    </Page>
  )

  return (
    <Page title={t('yourOrder')}>
      <ul className="cart-list">
        {lines.map(({ item, qty }) => (
          <li key={item.id} className="cart-line">
            <div className="cart-line-name">
              <span>{pick(item, 'name', lang)}</span>
              <span className="muted">{rsd(item.price)}</span>
            </div>
            <div className="qty">
              <button type="button" className="qty-btn" onClick={() => setQty(item.id, qty - 1)} aria-label={t('remove')}>−</button>
              <span>{qty}</span>
              <button type="button" className="qty-btn" onClick={() => setQty(item.id, qty + 1)} aria-label={t('add')}>+</button>
            </div>
            <span className="price">{rsd(item.price * qty)}</span>
          </li>
        ))}
      </ul>

      <div className="cart-total">
        <span>{t('total')}</span>
        <strong>{rsd(total)}</strong>
      </div>
      <p className="cart-points">
        <strong>{t('pointsEarn', { n: points })}</strong> · <span className="muted">{t('toNextPoint', { n: toNext })}</span>
      </p>

      <form onSubmit={submit}>
        <Field
          label={t('tableNumber')} name="table" required inputMode="numeric" maxLength={2} value={table}
          onChange={e => setTable(e.target.value.replace(/\D/g, ''))} hint={t('tableHint')}
        />
        <Field label={t('note')} name="note" maxLength={200} value={note} placeholder={t('notePlaceholder')} onChange={e => setNote(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-big" disabled={busy || !tableOk}>{t('sendToWaiter')}</button>
      </form>
    </Page>
  )
}
