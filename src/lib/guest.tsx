import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { GuestStats } from './api'
import type { Lang } from './i18n'

export const RSD_PER_POINT = 200

export const rsd = (n: number) => `${n.toLocaleString('sr-RS')} RSD`

// Serbian: 1 ocena, 2–4 ocene, 5+ ocena (with the 11–14 exception).
export function srPlural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const pointsWord = (n: number, lang: Lang) =>
  lang === 'sr' ? srPlural(n, 'bod', 'boda', 'bodova') : n === 1 ? 'point' : 'points'

export const ratingsWord = (n: number, lang: Lang) =>
  lang === 'sr' ? srPlural(n, 'ocena', 'ocene', 'ocena') : n === 1 ? 'rating' : 'ratings'

/** Picks name_sr / name_en (or any other field pair) for the current language. */
export function pick<T extends object>(row: T, field: string, lang: Lang): string {
  const r = row as Record<string, unknown>
  return (r[`${field}_${lang}`] as string) || (r[`${field}_sr`] as string) || ''
}

export const RANKS = [
  { name: 'Saradnik', min: 0 },
  { name: 'Vojnik', min: 10 },
  { name: 'Kapo', min: 30 },
  { name: 'Desna ruka', min: 75 },
  { name: 'Don', min: 150 },
]

export function rankFor(lifetime: number) {
  let i = 0
  while (i + 1 < RANKS.length && lifetime >= RANKS[i + 1].min) i++
  return { current: RANKS[i], next: RANKS[i + 1] ?? null }
}

export const TITLES = ['Kum', 'Podšef', 'Konsiljere']

type Badge = { key: string; name: string; sr: string; en: string; earned: (s: GuestStats) => boolean }

export const BADGES: Badge[] = [
  { key: 'first', name: 'Prva kafa', sr: 'Prva dostavljena porudžbina', en: 'First delivered order', earned: s => s.delivered_orders >= 1 },
  { key: 'regular', name: 'Stalni gost', sr: '10 porudžbina', en: '10 delivered orders', earned: s => s.delivered_orders >= 10 },
  { key: 'loyal', name: 'Odan porodici', sr: '50 porudžbina', en: '50 delivered orders', earned: s => s.delivered_orders >= 50 },
  { key: 'legend', name: 'Legenda', sr: '100 porudžbina', en: '100 delivered orders', earned: s => s.delivered_orders >= 100 },
  { key: 'offer', name: 'Ponuda koja se ne odbija', sr: 'Prva iskorišćena nagrada', en: 'First reward used', earned: s => s.rewards_used >= 1 },
  { key: 'collector', name: 'Kolekcionar', sr: '5 iskorišćenih nagrada', en: '5 rewards used', earned: s => s.rewards_used >= 5 },
  { key: 'morning', name: 'Jutarnji espreso', sr: 'Porudžbina pre 9:00', en: 'An order before 9:00', earned: s => s.early_order },
  { key: 'midnight', name: 'Ponoćni sastanak', sr: 'Porudžbina posle 22:00', en: 'An order after 22:00', earned: s => s.late_order },
  { key: 'critic', name: 'Kritičar', sr: '5 ocenjenih stavki', en: '5 menu items rated', earned: s => s.rated_items >= 5 },
  { key: 'gourmet', name: 'Gurman', sr: '10 različitih stavki', en: '10 different items tried', earned: s => s.tried_items >= 10 },
  { key: 'bigdeal', name: 'Veliki posao', sr: 'Porudžbina od 2.000 RSD', en: 'One order of 2,000 RSD', earned: s => s.big_order },
  { key: 'sunday', name: 'Nedeljni ručak', sr: '5 porudžbina vikendom', en: '5 weekend orders', earned: s => s.weekend_orders >= 5 },
  { key: 'oldfriend', name: 'Stari prijatelj', sr: 'Porudžbine u 3 različita meseca', en: 'Orders in 3 different months', earned: s => s.distinct_months >= 3 },
  { key: 'throne', name: 'Na prestolu', sr: 'Top 3 svih vremena', en: 'Top 3 of all time', earned: s => s.all_time_place !== null && s.all_time_place <= 3 },
]

// The cart lives in this tab until the order is sent.
type Cart = Record<string, number>
type CartCtx = { cart: Cart; setQty: (id: string, qty: number) => void; clear: () => void; count: number }
const CartContext = createContext<CartCtx>({ cart: {}, setQty: () => {}, clear: () => {}, count: 0 })

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => {
    try { return JSON.parse(sessionStorage.getItem('padrino.cart') ?? '{}') } catch { return {} }
  })
  useEffect(() => { try { sessionStorage.setItem('padrino.cart', JSON.stringify(cart)) } catch { /* ignore */ } }, [cart])

  const setQty = (id: string, qty: number) => setCart(c => {
    const next = { ...c }
    if (qty <= 0) delete next[id]
    else next[id] = Math.min(qty, 20)
    return next
  })
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  return <CartContext.Provider value={{ cart, setQty, clear: () => setCart({}), count }}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
