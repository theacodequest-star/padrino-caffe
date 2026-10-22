import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { Loading } from '../components/Loading'
import { Sheet } from '../components/Sheet'
import { StarInput, Stars } from '../components/Stars'
import { api, type MenuItem } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { isManager, isStaff, useAuth } from '../lib/auth'
import { pick, ratingsWord, rsd, useCart } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

export function Menu() {
  const { t, lang } = useI18n()
  const { profile } = useAuth()
  const { cart, setQty, count } = useCart()
  const menu = useLoad(() => api.menu())
  const rated = useLoad(() => api.myRatedItemIds())
  const [open, setOpen] = useState<MenuItem | null>(null)
  const canOrder = !isStaff(profile?.role)

  if (!menu.data) return <Page title={t('menu')}><Loading error={menu.error} /></Page>
  const { categories, items } = menu.data
  const total = items.reduce((s, i) => s + (cart[i.id] ?? 0) * i.price, 0)

  return (
    <Page title={t('menu')}>
      {isManager(profile?.role) && <Link to="/admin/menu" className="btn btn-ghost" style={{ marginBottom: 14 }}>{t('editMenu')}</Link>}
      <nav className="chips" aria-label={t('menu')}>
        {categories.map(c => <a key={c.id} href={`#cat-${c.id}`} className="chip">{pick(c, 'name', lang)}</a>)}
      </nav>

      {categories.map(c => (
        <section key={c.id} id={`cat-${c.id}`} className="menu-cat">
          <h2 className="section-title">{pick(c, 'name', lang)}</h2>
          <ul className="menu-list">
            {items.filter(i => i.category_id === c.id).map(i => {
              const qty = cart[i.id] ?? 0
              return (
                <li key={i.id} className={`menu-item ${i.available ? '' : 'is-off'}`}>
                  <button className="menu-item-body" onClick={() => setOpen(i)}>
                    <span className="menu-item-name">{pick(i, 'name', lang)}</span>
                    {pick(i, 'description', lang) && <span className="menu-item-desc">{pick(i, 'description', lang)}</span>}
                    <span className="menu-item-meta">
                      {i.rating_count > 0
                        ? <><Stars value={i.avg_rating ?? 0} size={14} /> {i.avg_rating?.toFixed(1)} · {i.rating_count} {ratingsWord(i.rating_count, lang)}</>
                        : <span className="muted">{t('noRatings')}</span>}
                    </span>
                    {!i.available && <span className="badge-off">{t('unavailable')}</span>}
                  </button>
                  <div className="menu-item-side">
                    <span className="price">{rsd(i.price)}</span>
                    {canOrder && i.available && (
                      qty === 0
                        ? <button className="qty-btn" onClick={() => setQty(i.id, 1)} aria-label={`${t('add')} ${pick(i, 'name', lang)}`}>+</button>
                        : <div className="qty">
                            <button className="qty-btn" onClick={() => setQty(i.id, qty - 1)} aria-label={t('remove')}>−</button>
                            <span aria-live="polite">{qty}</span>
                            <button className="qty-btn" onClick={() => setQty(i.id, qty + 1)} aria-label={t('add')}>+</button>
                          </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {canOrder && count > 0 && (
        <Link to="/order/new" className="cart-bar">
          <span>{count} {t('items')} · {rsd(total)}</span>
          <span>{t('viewOrder')} ›</span>
        </Link>
      )}

      {open && (
        <RateSheet
          item={open}
          allowed={rated.data?.allowed.includes(open.id) ?? false}
          mine={rated.data?.mine[open.id] ?? 0}
          onClose={() => setOpen(null)}
          onRated={() => { rated.reload(); menu.reload() }}
        />
      )}
    </Page>
  )
}

function RateSheet({ item, allowed, mine, onClose, onRated }: {
  item: MenuItem; allowed: boolean; mine: number; onClose: () => void; onRated: () => void
}) {
  const { t, lang } = useI18n()
  const [stars, setStars] = useState(mine)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const rate = async (v: number) => {
    setStars(v); setState('busy')
    try { await api.rateItem(item.id, v); setState('done'); onRated() } catch { setState('error') }
  }

  return (
    <Sheet onClose={onClose} label={pick(item, 'name', lang)}>
      <h2 className="section-title" style={{ marginTop: 0 }}>{pick(item, 'name', lang)}</h2>
      {pick(item, 'description', lang) && <p>{pick(item, 'description', lang)}</p>}
      <p className="menu-item-meta">
        {item.rating_count > 0
          ? <><Stars value={item.avg_rating ?? 0} /> {item.avg_rating?.toFixed(1)} · {item.rating_count} {ratingsWord(item.rating_count, lang)}</>
          : t('noRatings')}
      </p>
      <h3 className="field-label">{mine ? t('yourRating') : t('rateItem')}</h3>
      {allowed
        ? <StarInput value={stars} onChange={rate} label={t('rateItem')} />
        : <p className="muted">{t('rateOnlyHad')}</p>}
      {state === 'done' && <p className="field-ok">{t('thanksRating')}</p>}
      {state === 'error' && <p className="form-error">{t('error')}</p>}
      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={onClose}>{t('close')}</button>
    </Sheet>
  )
}
