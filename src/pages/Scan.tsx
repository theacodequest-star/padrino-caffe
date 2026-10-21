import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { Cz } from '../components/Cz'
import { Scanner } from '../components/Scanner'
import { api, type Order } from '../lib/api'
import { useI18n, type StringKey } from '../lib/i18n'
import { pick, rsd } from '../lib/guest'

const CODE = /^[A-Z0-9]{6}$/

export function Scan() {
  const { t, lang } = useI18n()
  const [code, setCode] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [busy, setBusy] = useState(false)

  const lookup = async (raw: string) => {
    const c = raw.replace(/^padrino:order:/i, '').trim().toUpperCase()
    if (!CODE.test(c) || busy) return
    setBusy(true); setMsg(null)
    try {
      const o = await api.orderByCode(c)
      if (!o) setMsg({ text: t('orderNotFound'), kind: 'error' })
      else if (o.status === 'expired') setMsg({ text: t('orderExpired'), kind: 'error' })
      else if (o.status !== 'waiting') setMsg({ text: t('orderHandled', { s: t(`st_${o.status}` as StringKey) }), kind: 'error' })
      else setOrder(o)
    } catch { setMsg({ text: t('error'), kind: 'error' }) }
    setBusy(false)
  }

  const decide = async (confirm: boolean) => {
    if (!order) return
    setBusy(true)
    try {
      await (confirm ? api.confirmOrder(order.id) : api.rejectOrder(order.id))
      setMsg({ text: confirm ? t('confirmed') : t('rejected'), kind: 'ok' })
      setOrder(null); setCode('')
    } catch { setMsg({ text: t('error'), kind: 'error' }) }
    setBusy(false)
  }

  const submit = (e: FormEvent) => { e.preventDefault(); lookup(code) }

  return (
    <Page title={t('scanOrder')}>
      {order ? (
        <div className="card scan-result">
          <div className="scan-table"><span className="field-label">{t('table')}</span><strong>{order.table_number}</strong></div>
          <p className="muted center">{order.code}</p>
          <ul className="summary">
            {order.lines.map(l => <li key={l.item_id}><span>{l.quantity} × {pick(l, 'name', lang)}</span><span>{rsd(l.price * l.quantity)}</span></li>)}
          </ul>
          <div className="cart-total"><span>{t('total')}</span><strong>{rsd(order.total)}</strong></div>
          {order.note && <p className="note">„{order.note}“</p>}
          <div className="stack" style={{ marginTop: 16 }}>
            <button className="btn btn-big" disabled={busy} onClick={() => decide(true)}>{t('confirmGuest')}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => decide(false)}>{t('rejectGuest')}</button>
          </div>
        </div>
      ) : (
        <>
          <Scanner onResult={lookup} paused={busy} />
          <p className="muted center">{t('scanHint')}</p>
          <form onSubmit={submit} className="code-form">
            <label className="field">
              <span className="field-label">{t('typeCode')}</span>
              <input value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                className="code-input" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            </label>
            <button className="btn" disabled={busy || !CODE.test(code)}>{t('find')}</button>
          </form>
        </>
      )}
      {msg && <p className={`scan-msg ${msg.kind}`} role="status">{msg.text}</p>}
      {msg?.kind === 'ok' && <Link to="/orders" className="btn btn-ghost"><Cz>{t('orders')}</Cz></Link>}
    </Page>
  )
}
