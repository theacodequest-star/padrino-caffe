// Preview mode with sample data, for checking screens before the database is connected.
// Open any page with ?demo (or ?demo=waiter / admin / owner) to turn it on for the tab.
import type { Api, Category, EventItem, MenuItem, Order, OrderStatus, Person, Reward, StaffOrder, WaiterReview } from './api'
import type { Profile, Role } from './auth'

const param = new URLSearchParams(window.location.search).get('demo')
let stored: string | null = null
try {
  if (param !== null) sessionStorage.setItem('padrino.demo', param || 'guest')
  stored = sessionStorage.getItem('padrino.demo')
} catch { stored = param }

const role = (['guest', 'waiter', 'admin', 'owner'].includes(stored ?? '') ? stored : 'guest') as Role

const profile: Profile = {
  id: 'demo-user', full_name: 'Marko Petrović', nickname: 'Don Marko', birth_year: 1994, role,
  language: 'sr', hide_from_leaderboard: false, event_emails: true, warned_until: null, banned: false,
}

const categories: Category[] = [
  { id: 'c1', name_sr: 'Kafa', name_en: 'Coffee', sort_order: 1 },
  { id: 'c2', name_sr: 'Topli napici', name_en: 'Hot drinks', sort_order: 2 },
  { id: 'c3', name_sr: 'Kokteli', name_en: 'Cocktails', sort_order: 3 },
]

const item = (id: string, category_id: string, name_sr: string, name_en: string, price: number,
  avg: number | null, count: number, desc?: [string, string], available = true): MenuItem => ({
  id, category_id, name_sr, name_en, price, available, sort_order: Number(id.slice(1)),
  description_sr: desc?.[0] ?? null, description_en: desc?.[1] ?? null, avg_rating: avg, rating_count: count,
})

const items: MenuItem[] = [
  item('i1', 'c1', 'Espresso', 'Espresso', 160, 4.8, 52),
  item('i2', 'c1', 'Kapućino', 'Cappuccino', 220, 4.6, 41, ['Espresso, mleko i mlečna pena', 'Espresso, milk and milk foam']),
  item('i3', 'c1', 'Domaća kafa', 'Turkish coffee', 140, 4.9, 77),
  item('i4', 'c1', 'Frape', 'Frappé', 260, null, 0, ['Hladna kafa sa šlagom', 'Iced coffee with whipped cream'], false),
  item('i5', 'c2', 'Topla čokolada', 'Hot chocolate', 280, 4.4, 18),
  item('i6', 'c2', 'Čaj', 'Tea', 180, 4.1, 9, ['Nana, kamilica ili zeleni', 'Mint, chamomile or green']),
  item('i7', 'c3', 'Negroni', 'Negroni', 650, 4.7, 23, ['Džin, kampari, crveni vermut', 'Gin, Campari, red vermouth']),
  item('i8', 'c3', 'Aperol Spritz', 'Aperol Spritz', 590, 4.5, 31),
]

const rewards: Reward[] = [
  { id: 'r1', name_sr: 'Kafa po izboru', name_en: 'Coffee of your choice', cost: 20, sort_order: 1, visible: true },
  { id: 'r2', name_sr: 'Topla čokolada', name_en: 'Hot chocolate', cost: 30, sort_order: 2, visible: true },
  { id: 'r3', name_sr: 'Koktel po izboru', name_en: 'Cocktail of your choice', cost: 80, sort_order: 3, visible: true },
]

const events: EventItem[] = [
  { id: 'e1', title_sr: 'Karaoke veče', title_en: 'Karaoke night', description_sr: 'Pevamo do ponoći.', description_en: 'We sing until midnight.', date: '2026-10-24', time: '21:00' },
  { id: 'e2', title_sr: 'Kviz: Kum', title_en: 'Godfather quiz', description_sr: 'Ekipe do 4 člana. Nagrada za pobednike.', description_en: 'Teams of up to 4. A prize for the winners.', date: '2026-10-31', time: '20:00' },
]

let order: Order | null = null

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
const line = (id: string, quantity: number) => {
  const it = items.find(i => i.id === id)!
  return { item_id: id, name_sr: it.name_sr, name_en: it.name_en, quantity, price: it.price }
}
const staffOrder = (id: string, code: string, table: number, status: OrderStatus, min: number, lines: ReturnType<typeof line>[], note: string | null = null): StaffOrder => {
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  return { id, code, table_number: table, note, status, total, points: Math.floor(total / 200), created_at: ago(min + 1),
    confirmed_at: ago(min), waiter_id: null, guest_nickname: null, lines }
}
const staffOrders: StaffOrder[] = [
  staffOrder('s1', 'B4T9KQ', 3, 'new', 2, [line('i1', 2), line('i5', 1)]),
  staffOrder('s2', 'H2M8ZD', 12, 'preparing', 6, [line('i7', 2), line('i8', 2)], 'Jedan bez leda'),
  staffOrder('s3', 'P7X3LN', 5, 'ready', 9, [line('i3', 3)]),
  staffOrder('s4', 'Q9C5RE', 8, 'delivered', 34, [line('i2', 2), line('i6', 1)]),
  staffOrder('s5', 'W3V6JA', 1, 'rejected', 51, [line('i1', 1)]),
]
const sleep = (ms = 250) => new Promise(r => setTimeout(r, ms))

const base = {
  async menu() { await sleep(); return { categories, items } },
  async myRatedItemIds() { return { allowed: ['i1', 'i2', 'i3'], mine: { i3: 5 } } },
  async rateItem() { await sleep() },
  async placeOrder(table, note, lines) {
    await sleep()
    const full = lines.map(l => {
      const it = items.find(i => i.id === l.item_id)!
      return { item_id: it.id, name_sr: it.name_sr, name_en: it.name_en, quantity: l.quantity, price: it.price }
    })
    const total = full.reduce((s, l) => s + l.price * l.quantity, 0)
    order = {
      id: 'o1', code: 'K7M2QX', table_number: table, note: note || null, status: 'waiting', total,
      points: Math.floor(total / 200), created_at: new Date().toISOString(), waiter_id: null, lines: full,
    }
    return order
  },
  async cancelOrder() { order = null },
  async myOpenOrder() { return order && !['delivered', 'rejected', 'expired'].includes(order.status) ? order : null },
  async order() {
    const forced = new URLSearchParams(window.location.search).get('status') as OrderStatus | null
    if (!order) await demoApi.placeOrder(7, 'Bez šećera', [{ item_id: 'i2', quantity: 2 }, { item_id: 'i7', quantity: 1 }])
    if (forced) order!.status = forced
    return order!
  },
  watchOrder() { return () => {} },
  async reviewWaiter() { await sleep() },
  async rewards() { return rewards },
  async pointHistory() {
    return [
      { id: 'p1', points: 6, reason: 'order', created_at: '2026-10-19T18:22:00Z' },
      { id: 'p2', points: -20, reason: 'reward', created_at: '2026-10-12T10:05:00Z' },
      { id: 'p3', points: 9, reason: 'order', created_at: '2026-10-08T21:40:00Z' },
      { id: 'p4', points: 4, reason: 'order', created_at: '2026-09-30T08:15:00Z' },
    ]
  },
  async myStats() {
    return {
      balance: 24, lifetime: 44, delivered_orders: 12, rewards_used: 1, rated_items: 3, tried_items: 6,
      early_order: true, late_order: false, big_order: false, weekend_orders: 3, distinct_months: 3, all_time_place: 5,
    }
  },
  async leaderboard(month) {
    const base = [['Kum Đorđe', 182], ['Sonny', 151], ['Konsiljere Tom', 120], ['Fredo', 77], ['Don Marko', 44], ['Kej', 38], ['Luka B.', 21]] as const
    return base.map(([nickname, points]) => ({
      nickname, points: month ? Math.round(points / 4) : points, is_me: nickname === 'Don Marko',
    }))
  },
  async setHideFromLeaderboard(hide) { profile.hide_from_leaderboard = hide },
  async orderWaiter() { return { waiter_name: 'Jelena', stars: null, comment: null } },
  async nicknameTaken(n) { return ['kum đorđe', 'sonny', 'fredo'].includes(n.toLowerCase()) },
  async events() { return events },
  async setEventEmails(on: boolean) { profile.event_emails = on },

  async orderByCode(code) {
    await sleep()
    if (code.toUpperCase() === 'K7M2QX') return { ...(await demoApi.order('o1')), status: 'waiting' }
    return staffOrders.find(o => o.code === code.toUpperCase()) ?? null
  },
  async confirmOrder() { await sleep() },
  async rejectOrder() { await sleep() },
  async advanceOrder(order) {
    const o = staffOrders.find(x => x.id === order.id)
    const next: Partial<Record<OrderStatus, OrderStatus>> = { new: 'preparing', preparing: 'ready', ready: 'delivered' }
    if (o && next[o.status]) o.status = next[o.status]!
  },
  async ordersForDay() { await sleep(); return staffOrders.map(o => ({ ...o })) },
  watchOrders() { return () => {} },
  async member(userId) {
    await sleep()
    return { user_id: userId, nickname: 'Don Marko', full_name: 'Marko Petrović', balance: 24, blocked: false }
  },
  async redeemReward() { await sleep(); return 4 },
  async saveCategory(c) {
    if (c.id) Object.assign(categories.find(x => x.id === c.id)!, c)
    else categories.push({ id: `c${Date.now()}`, name_sr: '', name_en: '', sort_order: categories.length + 1, ...c })
  },
  async deleteCategory(id) {
    categories.splice(categories.findIndex(c => c.id === id), 1)
    for (let i = items.length - 1; i >= 0; i--) if (items[i].category_id === id) items.splice(i, 1)
  },
  async saveItem(i) {
    if (i.id) Object.assign(items.find(x => x.id === i.id)!, i)
    else items.push({ id: `i${Date.now()}`, category_id: '', name_sr: '', name_en: '', description_sr: null, description_en: null,
      price: 0, available: true, sort_order: items.length + 1, avg_rating: null, rating_count: 0, ...i })
  },
  async deleteItem(id) { items.splice(items.findIndex(i => i.id === id), 1) },
  async setAvailable(id, available) { items.find(i => i.id === id)!.available = available },
} satisfies Partial<Api>

const people: Person[] = [
  { id: 'demo-user', full_name: 'Marko Petrović', nickname: 'Don Marko', email: 'marko@example.com', role, created_at: '2024-03-02T10:00:00Z', warned_until: null, banned: false },
  { id: 'w1', full_name: 'Jelena Marković', nickname: 'Jeca', email: 'jelena@example.com', role: 'waiter', created_at: '2025-01-15T10:00:00Z', warned_until: null, banned: false },
  { id: 'w2', full_name: 'Stefan Ilić', nickname: 'Stefke', email: 'stefan@example.com', role: 'waiter', created_at: '2025-06-01T10:00:00Z', warned_until: null, banned: false },
  { id: 'a1', full_name: 'Ana Jovanović', nickname: 'Ana', email: 'ana@example.com', role: 'admin', created_at: '2024-11-20T10:00:00Z', warned_until: null, banned: false },
  { id: 'g1', full_name: 'Nikola Đorđević', nickname: 'Kum Đorđe', email: 'nikola@example.com', role: 'guest', created_at: '2025-02-11T10:00:00Z', warned_until: null, banned: false },
  { id: 'g2', full_name: 'Milan Stojanović', nickname: 'Ružan Nadimak', email: 'milan@example.com', role: 'guest', created_at: '2026-09-28T10:00:00Z', warned_until: new Date(Date.now() + 15 * 3600e3).toISOString(), banned: false },
  { id: 'g3', full_name: 'Petar Nikolić', nickname: 'Fredo', email: 'petar@example.com', role: 'guest', created_at: '2026-01-05T10:00:00Z', warned_until: null, banned: true },
]

const reviews: WaiterReview[] = [
  { id: 'v1', stars: 5, comment: 'Brza i ljubazna, kafa savršena.', created_at: ago(90), waiter_id: 'w1', waiter_name: 'Jelena Marković', guest_name: 'Nikola Đorđević', guest_nickname: 'Kum Đorđe' },
  { id: 'v2', stars: 4, comment: null, created_at: ago(400), waiter_id: 'w2', waiter_name: 'Stefan Ilić', guest_name: 'Marko Petrović', guest_nickname: 'Don Marko' },
  { id: 'v3', stars: 5, comment: 'Najbolji konobar u gradu.', created_at: ago(1500), waiter_id: 'w2', waiter_name: 'Stefan Ilić', guest_name: 'Petar Nikolić', guest_nickname: 'Fredo' },
  { id: 'v4', stars: 3, comment: 'Malo smo čekali, ali gužva je bila.', created_at: ago(3000), waiter_id: 'w1', waiter_name: 'Jelena Marković', guest_name: 'Marko Petrović', guest_nickname: 'Don Marko' },
]

const statsFor = (from: string, to: string) => {
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1)
  const by_day = Array.from({ length: days }, (_, i) => {
    const d = new Date(new Date(from).getTime() + i * 864e5)
    const wk = d.getDay() === 0 || d.getDay() === 6
    return { day: d.toISOString().slice(0, 10), revenue: Math.round((wk ? 21000 : 14000) + 6000 * Math.sin(i * 1.7) + 3000 * Math.cos(i * 0.9)) }
  })
  const revenue = by_day.reduce((s, d) => s + d.revenue, 0)
  const orders = Math.round(revenue / 640)
  const curve = [0, 0, 0, 0, 0, 0, 0, 4, 9, 12, 10, 8, 9, 11, 8, 6, 7, 10, 14, 18, 21, 17, 11, 5]
  return {
    revenue, orders, avg_bill: Math.round(revenue / orders), guests: Math.round(orders * 0.55), new_members: Math.max(1, Math.round(days * 0.8)),
    points_given: Math.round(revenue / 200), rewards_used: Math.max(0, Math.round(days * 0.6)), rejected: Math.max(0, Math.round(days * 0.3)),
    by_day, by_hour: curve.map((v, hour) => ({ hour, orders: Math.round(v * days * 0.6) })).filter(h => h.orders > 0),
    top_selling: [['i3', 3.1], ['i2', 2.4], ['i1', 2.2], ['i7', 0.9], ['i8', 0.8]].map(([id, k]) => {
      const it = items.find(i => i.id === id)!; const qty = Math.round((k as number) * days * 10)
      return { item_id: it.id, name_sr: it.name_sr, name_en: it.name_en, qty, revenue: qty * it.price }
    }),
    top_rated: [...items].filter(i => i.avg_rating).sort((a, b) => b.avg_rating! - a.avg_rating!).slice(0, 5)
      .map(i => ({ item_id: i.id, name_sr: i.name_sr, name_en: i.name_en, avg: i.avg_rating!, count: i.rating_count })),
  }
}

const admin = {
  async stats(from: string, to: string) { await sleep(); return statsFor(from, to) },
  async people(query: string, staffOnly: boolean) {
    await sleep()
    const q = query.toLowerCase()
    return people.filter(p => (!staffOnly || p.role !== 'guest') &&
      (!q || [p.full_name, p.nickname, p.email].some(v => v?.toLowerCase().includes(q))))
  },
  async setRole(id: string, r: Person['role']) { people.find(p => p.id === id)!.role = r },
  async warn(id: string) { people.find(p => p.id === id)!.warned_until = new Date(Date.now() + 864e5).toISOString() },
  async removeWarning(id: string) { people.find(p => p.id === id)!.warned_until = null },
  async ban(id: string) { Object.assign(people.find(p => p.id === id)!, { banned: true, warned_until: null }) },
  async unban(id: string) { people.find(p => p.id === id)!.banned = false },
  async allRewards() { return [...rewards, { id: 'r4', name_sr: 'Desert dana', name_en: 'Dessert of the day', cost: 40, sort_order: 4, visible: false }] },
  async saveReward(r: Partial<Reward>) {
    if (r.id) Object.assign(rewards.find(x => x.id === r.id) ?? {}, r)
    else rewards.push({ id: `r${Date.now()}`, name_sr: '', name_en: '', cost: 0, sort_order: rewards.length + 1, visible: true, ...r })
  },
  async deleteReward(id: string) { const i = rewards.findIndex(r => r.id === id); if (i >= 0) rewards.splice(i, 1) },
  async waiterReviews() { await sleep(); return reviews },
  async allEvents() { return events },
  async saveEvent(e: Partial<EventItem>) {
    if (e.id) Object.assign(events.find(x => x.id === e.id)!, e)
    else events.push({ id: `e${Date.now()}`, title_sr: '', title_en: '', description_sr: null, description_en: null, date: '', time: '', ...e })
  },
  async deleteEvent(id: string) { events.splice(events.findIndex(e => e.id === id), 1) },
  async notifyEvent(id: string) {
    await sleep(600)
    const e = events.find(x => x.id === id)
    if (e) e.announced_at = new Date().toISOString()
    return 37
  },
  async eventAudience(days: number) { return days >= 60 ? 37 : 24 },
  async changeNickname(n: string) { profile.nickname = n; profile.warned_until = null },
} satisfies Partial<Api>

const demoApi: Api = { ...base, ...admin }

if (new URLSearchParams(window.location.search).has('warned')) profile.warned_until = new Date(Date.now() + 20 * 3600e3).toISOString()
if (new URLSearchParams(window.location.search).has('banned')) profile.banned = true

export const demo = { on: stored !== null, role, profile, api: demoApi }
