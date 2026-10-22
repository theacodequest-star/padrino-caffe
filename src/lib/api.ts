// Every database call the app makes goes through here, and the rows are mapped to
// the app's own shapes, so a change in the database only needs fixing in this file.
import { supabase } from './supabase'
import { demo } from './demo'
import type { Role } from './auth'

export type Category = { id: string; name_sr: string; name_en: string; sort_order: number }
export type MenuItem = {
  id: string
  category_id: string
  name_sr: string
  name_en: string
  description_sr: string | null
  description_en: string | null
  price: number
  available: boolean
  sort_order: number
  avg_rating: number | null
  rating_count: number
}
export type OrderStatus = 'waiting' | 'new' | 'preparing' | 'ready' | 'delivered' | 'rejected' | 'expired'
const OPEN_STATUSES: OrderStatus[] = ['waiting', 'new', 'preparing', 'ready']
const HIDDEN_FROM_STAFF: OrderStatus[] = ['waiting', 'expired']
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { new: 'preparing', preparing: 'ready', ready: 'delivered' }
export type OrderLine = { item_id: string; name_sr: string; name_en: string; quantity: number; price: number }
export type Order = {
  id: string
  code: string
  table_number: number
  note: string | null
  status: OrderStatus
  total: number
  points: number
  created_at: string
  waiter_id: string | null
  lines: OrderLine[]
}
export type StaffOrder = Order & { confirmed_at: string | null; guest_nickname: string | null }
export type MemberSummary = { user_id: string; nickname: string; full_name: string | null; balance: number; blocked: boolean }
export type Stats = {
  revenue: number; orders: number; avg_bill: number; guests: number; new_members: number
  points_given: number; rewards_used: number; rejected: number
  by_day: { day: string; revenue: number }[]
  by_hour: { hour: number; orders: number }[]
  top_selling: { item_id: string; name_sr: string; name_en: string; qty: number; revenue: number }[]
  top_rated: { item_id: string; name_sr: string; name_en: string; avg: number; count: number }[]
}
export type Person = {
  id: string; full_name: string | null; nickname: string | null; email: string | null; role: Role
  created_at: string; warned_until: string | null; banned: boolean
}
export type WaiterReview = {
  id: string; stars: number; comment: string | null; created_at: string
  waiter_id: string; waiter_name: string; guest_name: string | null; guest_nickname: string | null
}
export type Reward = { id: string; name_sr: string; name_en: string; cost: number; sort_order: number; visible: boolean }
export type PointEntry = {
  id: string; points: number; reason: string; created_at: string
  reward_name_sr?: string | null; reward_name_en?: string | null
}
export type EventItem = {
  id: string
  title_sr: string
  title_en: string
  description_sr: string | null
  description_en: string | null
  date: string
  time: string
  announced_at?: string | null
}
export type LeaderRow = { nickname: string; points: number; is_me: boolean }
export type GuestStats = {
  balance: number
  lifetime: number
  delivered_orders: number
  rewards_used: number
  rated_items: number
  tried_items: number
  early_order: boolean
  late_order: boolean
  big_order: boolean
  weekend_orders: number
  distinct_months: number
  all_time_place: number | null
}

const check = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

// ---- Mapping between the database rows and the app's shapes ----
// Database ids are bigint; the app keeps them as strings and converts back when calling Supabase.
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (id: string) => Number(id)
const pointsFor = (total: number) => Math.floor(total / 200)
const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const toItem = (r: Row, ratings: Map<string, { average: number; count: number }>): MenuItem => ({
  id: String(r.id), category_id: String(r.category_id), name_sr: r.name_sr, name_en: r.name_en,
  description_sr: r.description_sr, description_en: r.description_en, price: r.price_rsd,
  available: r.available, sort_order: r.sort_order,
  avg_rating: ratings.get(String(r.id)) ? Number(ratings.get(String(r.id))!.average) : null,
  rating_count: ratings.get(String(r.id))?.count ?? 0,
})
// The database calls a delivered order 'done'. An unscanned order counts as expired after
// 15 minutes even before the database gets round to marking it.
const EXPIRY_MS = 15 * 60 * 1000
const fromDbStatus = (r: Row): OrderStatus =>
  r.status === 'done' ? 'delivered'
  : r.status === 'waiting' && Date.now() - new Date(r.created_at).getTime() > EXPIRY_MS ? 'expired'
  : r.status
const toDbStatus = (s: OrderStatus) => (s === 'delivered' ? 'done' : s)
const fromDbRole = (r: string): Role => (r === 'customer' ? 'guest' : r) as Role
const toDbRole = (r: Role) => (r === 'guest' ? 'customer' : r)

const toOrder = (r: Row): StaffOrder => ({
  id: String(r.id), code: r.code, table_number: r.table_number, note: r.note || null, status: fromDbStatus(r),
  total: r.total_rsd, points: pointsFor(r.total_rsd), created_at: r.created_at, waiter_id: r.delivered_by ?? null,
  confirmed_at: r.confirmed_at ?? null, guest_nickname: null,
  lines: ((r.order_items ?? []) as Row[]).map(l => ({
    item_id: String(l.menu_item_id), name_sr: l.name_sr, name_en: l.name_en, quantity: l.quantity, price: l.price_rsd,
  })),
})
const toReward = (r: Row): Reward => ({
  id: String(r.id), name_sr: r.name_sr, name_en: r.name_en, cost: r.points_cost, sort_order: r.sort_order, visible: r.active,
})
const toEvent = (r: Row): EventItem => {
  const d = new Date(r.starts_at)
  return {
    id: String(r.id), title_sr: r.title_sr, title_en: r.title_en, description_sr: r.description_sr || null,
    description_en: r.description_en || null, date: localDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    announced_at: r.announced_at ?? null,
  }
}
const ORDER_SELECT = '*, order_items(*)'

const toStats = (j: Row): Stats => ({
  revenue: j.revenue, orders: j.orders, avg_bill: j.orders ? Math.round(j.revenue / j.orders) : 0, guests: j.guests,
  new_members: j.new_members, points_given: j.points_given, rewards_used: j.rewards_used, rejected: j.rejected,
  by_day: ((j.by_day ?? []) as Row[]).map(d => ({ day: d.day, revenue: d.revenue })),
  // Hours with no orders are left out so the chart covers opening hours only.
  by_hour: ((j.by_hour ?? []) as Row[]).filter(h => h.orders > 0).map(h => ({ hour: h.hour, orders: h.orders })),
  top_selling: ((j.top_items ?? []) as Row[]).map(i => ({ item_id: i.name_sr, name_sr: i.name_sr, name_en: i.name_en, qty: i.quantity, revenue: i.revenue })),
  top_rated: ((j.top_rated ?? []) as Row[]).map(i => ({ item_id: i.name_sr, name_sr: i.name_sr, name_en: i.name_en, avg: Number(i.average), count: i.count })),
})

async function myId() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('not signed in')
  return data.session.user.id
}

const live = {
  async menu() {
    const [cats, items, ratings] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
      supabase.rpc('menu_ratings'),
    ])
    const byItem = new Map<string, { average: number; count: number }>()
    for (const r of check<Row[]>(ratings) ?? []) byItem.set(String(r.menu_item_id), { average: r.average, count: r.count })
    return {
      categories: check<Row[]>(cats).map(c => ({ id: String(c.id), name_sr: c.name_sr, name_en: c.name_en, sort_order: c.sort_order })),
      items: check<Row[]>(items).map(i => toItem(i, byItem)),
    }
  },
  // Guests may only rate what they have had in a delivered order.
  async myRatedItemIds(): Promise<{ allowed: string[]; mine: Record<string, number> }> {
    const uid = await myId()
    const [had, mine] = await Promise.all([
      supabase.from('orders').select('order_items(menu_item_id)').eq('customer_id', uid).eq('status', 'done'),
      supabase.from('item_ratings').select('menu_item_id, stars').eq('customer_id', uid),
    ])
    const allowed = new Set<string>()
    for (const o of check<Row[]>(had)) for (const l of o.order_items as Row[]) allowed.add(String(l.menu_item_id))
    const rated: Record<string, number> = {}
    for (const r of check<Row[]>(mine)) rated[String(r.menu_item_id)] = r.stars
    return { allowed: [...allowed], mine: rated }
  },
  async rateItem(itemId: string, stars: number) {
    check(await supabase.rpc('rate_item', { p_menu_item_id: num(itemId), p_stars: stars }))
  },
  // Prices, totals and points are calculated by the database from the menu.
  async placeOrder(table: number, note: string, lines: { item_id: string; quantity: number }[]): Promise<Order> {
    const r = await supabase.rpc('place_order', {
      p_table_number: table, p_note: note, p_items: lines.map(l => ({ menu_item_id: num(l.item_id), quantity: l.quantity })),
    })
    return toOrder(check<Row>(r))
  },
  async cancelOrder(id: string) {
    check(await supabase.rpc('cancel_order', { p_order_id: num(id) }))
  },
  async myOpenOrder(): Promise<Order | null> {
    const r = await supabase.from('orders').select(ORDER_SELECT).eq('customer_id', await myId())
      .in('status', OPEN_STATUSES.map(toDbStatus)).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const row = check<Row | null>(r)
    return row ? toOrder(row) : null
  },
  async order(id: string): Promise<Order> {
    return toOrder(check<Row>(await supabase.from('orders').select(ORDER_SELECT).eq('id', num(id)).single()))
  },
  watchOrder(id: string, onChange: () => void) {
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, onChange)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },
  async reviewWaiter(orderId: string, stars: number, comment: string) {
    check(await supabase.rpc('review_waiter', { p_order_id: num(orderId), p_stars: stars, p_comment: comment }))
  },
  async rewards() {
    return check<Row[]>(await supabase.from('rewards').select('*').eq('active', true).order('sort_order')).map(toReward)
  },
  async pointHistory(): Promise<PointEntry[]> {
    const r = await supabase.from('point_entries').select('*').eq('customer_id', await myId()).order('created_at', { ascending: false }).limit(50)
    return check<Row[]>(r).map(e => ({ id: String(e.id), points: e.points, reason: e.reason, created_at: e.created_at, reward_name_sr: e.reward_name_sr, reward_name_en: e.reward_name_en }))
  },
  async myStats(): Promise<GuestStats> {
    const uid = await myId()
    const [standing, balance] = await Promise.all([
      supabase.rpc('my_family_standing'),
      supabase.rpc('points_balance', { p_customer_id: uid }),
    ])
    const j = check<Row>(standing)
    return {
      balance: check<number>(balance), lifetime: j.lifetime_points, delivered_orders: j.done_orders,
      rewards_used: j.rewards_used, rated_items: j.ratings_given, tried_items: j.distinct_items,
      early_order: j.early_orders > 0, late_order: j.late_orders > 0, big_order: j.biggest_order >= 2000,
      weekend_orders: j.weekend_orders, distinct_months: j.active_months, all_time_place: j.place ?? null,
    }
  },
  // The waiter who served a delivered order, and the guest's review of them if there is one.
  async orderWaiter(orderId: string): Promise<{ waiter_name: string; stars: number | null; comment: string | null } | null> {
    return check<Row | null>(await supabase.rpc('order_waiter', { p_order_id: num(orderId) })) as never
  },
  async leaderboard(month: string | null): Promise<LeaderRow[]> {
    const r = await supabase.rpc('leaderboard', { p_month: month ? `${month}-01` : null })
    return check<Row[]>(r).map(x => ({ nickname: x.nickname, points: x.points, is_me: x.is_me }))
  },
  async setHideFromLeaderboard(hide: boolean, userId: string) {
    check(await supabase.from('profiles').update({ hide_from_leaderboard: hide }).eq('id', userId))
  },
  async nicknameTaken(nickname: string) {
    return check<boolean>(await supabase.rpc('nickname_taken', { p_nickname: nickname }))
  },

  // ---- Staff ----
  async orderByCode(code: string): Promise<Order | null> {
    const row = check<Row | null>(await supabase.from('orders').select(ORDER_SELECT).eq('code', code.toUpperCase()).maybeSingle())
    return row ? toOrder(row) : null
  },
  // The database checks the code and table together, which proves the waiter is at the guest's table.
  async confirmOrder(o: Order) { check(await supabase.rpc('confirm_order', { p_code: o.code, p_table_number: o.table_number })) },
  async rejectOrder(o: Order) { check(await supabase.rpc('set_order_status', { p_order_id: num(o.id), p_status: 'rejected' })) },
  // Moves new → preparing → ready → delivered; the database records who delivered it.
  async advanceOrder(o: Order) {
    const next = NEXT_STATUS[o.status]
    if (next) check(await supabase.rpc('set_order_status', { p_order_id: num(o.id), p_status: toDbStatus(next) }))
  },
  async ordersForDay(day: string): Promise<StaffOrder[]> {
    const r = await supabase.from('orders').select(ORDER_SELECT).eq('order_day', day)
      .not('status', 'in', `(${HIDDEN_FROM_STAFF.map(toDbStatus).join(',')})`).order('created_at', { ascending: false })
    return check<Row[]>(r).map(toOrder)
  },
  watchOrders(onChange: () => void) {
    const ch = supabase.channel('orders-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },
  async member(userId: string): Promise<MemberSummary | null> {
    const [p, balance, blocked] = await Promise.all([
      supabase.from('profiles').select('id, name, nickname').eq('id', userId).maybeSingle(),
      supabase.rpc('points_balance', { p_customer_id: userId }),
      supabase.rpc('is_blocked', { p_user_id: userId }),
    ])
    const row = check<Row | null>(p)
    if (!row) return null
    return { user_id: row.id, nickname: row.nickname, full_name: row.name, balance: check<number>(balance), blocked: check<boolean>(blocked) }
  },
  // Returns the guest's new balance.
  async redeemReward(userId: string, rewardId: string) {
    return check<number>(await supabase.rpc('redeem_reward', { p_customer_id: userId, p_reward_id: num(rewardId) }))
  },
  async saveCategory(c: Partial<Category>) {
    const row = { name_sr: c.name_sr, name_en: c.name_en, sort_order: c.sort_order }
    check(c.id ? await supabase.from('menu_categories').update(row).eq('id', num(c.id)) : await supabase.from('menu_categories').insert(row))
  },
  async deleteCategory(id: string) {
    check(await supabase.from('menu_items').delete().eq('category_id', num(id)))
    check(await supabase.from('menu_categories').delete().eq('id', num(id)))
  },
  async saveItem(i: Partial<MenuItem>) {
    const row: Row = {}
    if (i.category_id !== undefined) row.category_id = num(i.category_id)
    for (const k of ['name_sr', 'name_en', 'description_sr', 'description_en', 'available', 'sort_order'] as const) if (i[k] !== undefined) row[k] = i[k]
    if (i.price !== undefined) row.price_rsd = i.price
    check(i.id ? await supabase.from('menu_items').update(row).eq('id', num(i.id)) : await supabase.from('menu_items').insert(row))
  },
  async deleteItem(id: string) { check(await supabase.from('menu_items').delete().eq('id', num(id))) },
  async setAvailable(id: string, available: boolean) {
    check(await supabase.from('menu_items').update({ available }).eq('id', num(id)))
  },

  // ---- Owner and admins ----
  async stats(from: string, to: string): Promise<Stats> {
    // owner_stats counts p_days back from p_end (today when left out), in Belgrade time.
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1
    return toStats(check<Row>(await supabase.rpc('owner_stats', { p_days: days, p_end: to })))
  },
  async people(query: string, staffOnly: boolean): Promise<Person[]> {
    const rows = check<Row[]>(await supabase.rpc('list_members', { p_search: query }))
    return rows
      .map(r => ({
        id: r.id, full_name: r.name, nickname: r.nickname, email: r.email, role: fromDbRole(r.role), created_at: r.created_at,
        warned_until: r.banned_at ? null : r.nickname_deadline, banned: !!r.banned_at,
      }))
      .filter(p => !staffOnly || p.role !== 'guest')
  },
  async setRole(userId: string, role: Role) { check(await supabase.rpc('set_member_role', { p_user_id: userId, p_role: toDbRole(role) })) },
  async warn(userId: string) { check(await supabase.rpc('warn_nickname', { p_user_id: userId })) },
  async removeWarning(userId: string) { check(await supabase.rpc('lift_moderation', { p_user_id: userId })) },
  async ban(userId: string) { check(await supabase.rpc('ban_member', { p_user_id: userId })) },
  async unban(userId: string) { check(await supabase.rpc('lift_moderation', { p_user_id: userId })) },
  async allRewards() { return check<Row[]>(await supabase.from('rewards').select('*').order('sort_order')).map(toReward) },
  async saveReward(r: Partial<Reward>) {
    const row: Row = {}
    if (r.name_sr !== undefined) row.name_sr = r.name_sr
    if (r.name_en !== undefined) row.name_en = r.name_en
    if (r.cost !== undefined) row.points_cost = r.cost
    if (r.sort_order !== undefined) row.sort_order = r.sort_order
    if (r.visible !== undefined) row.active = r.visible
    check(r.id ? await supabase.from('rewards').update(row).eq('id', num(r.id)) : await supabase.from('rewards').insert(row))
  },
  async deleteReward(id: string) { check(await supabase.from('rewards').delete().eq('id', num(id))) },
  async waiterReviews(): Promise<WaiterReview[]> {
    const rows = check<Row[]>(await supabase.rpc('waiter_reviews', { p_from: null, p_to: null }))
    return rows.map(r => ({
      id: String(r.order_id), stars: r.stars, comment: r.comment || null, created_at: r.created_at, waiter_id: r.waiter_id,
      waiter_name: r.waiter_name, guest_name: r.customer_name, guest_nickname: r.customer_nickname,
    })).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },
  async allEvents() { return check<Row[]>(await supabase.from('events').select('*').order('starts_at', { ascending: false })).map(toEvent) },
  async saveEvent(e: Partial<EventItem>) {
    const row = {
      title_sr: e.title_sr, title_en: e.title_en, description_sr: e.description_sr ?? '', description_en: e.description_en ?? '',
      starts_at: new Date(`${e.date}T${e.time}`).toISOString(),
    }
    check(e.id ? await supabase.from('events').update(row).eq('id', num(e.id)) : await supabase.from('events').insert(row))
  },
  async deleteEvent(id: string) { check(await supabase.from('events').delete().eq('id', num(id))) },
  // Queues an email about the event to everyone active in the last `days` days who wants event emails;
  // returns how many emails were queued. The send-emails function sends them within a few minutes.
  async notifyEvent(id: string, days: number) {
    return check<number>(await supabase.rpc('announce_event', { p_event_id: num(id), p_active_days: days }))
  },
  async eventAudience(days: number) {
    return check<number>(await supabase.rpc('event_audience', { p_active_days: days }))
  },
  async setEventEmails(on: boolean) {
    check(await supabase.from('profiles').update({ event_emails: on }).eq('id', await myId()))
  },
  // Owner account only: how much test activity there is, and deleting all of it.
  async testDataCounts() { return check<TestCounts>(await supabase.rpc('test_data_counts')) },
  async clearTestData() { return check<TestCounts>(await supabase.rpc('clear_test_data')) },
  // Calls onNew for each order a waiter confirms from now on, with who confirmed it.
  watchNewOrders(onNew: (orderId: string, confirmedBy: string | null) => void) {
    const ch = supabase.channel('order-alerts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.new' },
        p => onNew(String((p.new as Row).id), (p.new as Row).confirmed_by ?? null))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },

  // Only allowed while the account has a nickname warning.
  async changeNickname(nickname: string) {
    check(await supabase.from('profiles').update({ nickname }).eq('id', await myId()))
  },

  async events() {
    return check<Row[]>(await supabase.from('events').select('*').gte('starts_at', new Date().toISOString()).order('starts_at')).map(toEvent)
  },
}

export type TestCounts = { orders: number; points: number; ratings: number; reviews: number }

export type Api = typeof live
export const api: Api = demo.on ? demo.api : live
