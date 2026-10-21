// Every database call the app makes goes through here, so the table and column
// names only need checking against the existing Supabase migrations in one place.
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
export type PointEntry = { id: string; points: number; reason: string; created_at: string }
export type EventItem = {
  id: string
  title_sr: string
  title_en: string
  description_sr: string | null
  description_en: string | null
  date: string
  time: string
}
export type LeaderRow = { user_id: string; nickname: string; points: number }
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

const live = {
  async menu() {
    const [cats, items] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items_with_rating').select('*').order('sort_order'),
    ])
    return { categories: check<Category[]>(cats), items: check<MenuItem[]>(items) }
  },
  async myRatedItemIds(): Promise<{ allowed: string[]; mine: Record<string, number> }> {
    const [had, mine] = await Promise.all([
      supabase.rpc('my_delivered_item_ids'),
      supabase.from('item_ratings').select('item_id, stars'),
    ])
    const rated: Record<string, number> = {}
    for (const r of check<{ item_id: string; stars: number }[]>(mine)) rated[r.item_id] = r.stars
    return { allowed: check<string[]>(had), mine: rated }
  },
  async rateItem(itemId: string, stars: number) {
    check(await supabase.rpc('rate_item', { p_item_id: itemId, p_stars: stars }))
  },
  // Prices, totals and points are calculated by the database from the menu.
  async placeOrder(table: number, note: string, lines: { item_id: string; quantity: number }[]) {
    return check<Order>(await supabase.rpc('place_order', { p_table: table, p_note: note || null, p_items: lines }))
  },
  async cancelOrder(id: string) {
    check(await supabase.rpc('cancel_order', { p_order_id: id }))
  },
  async myOpenOrder() {
    const r = await supabase.from('orders').select('*, lines:order_items(*)')
      .in('status', ['waiting', 'new', 'preparing', 'ready']).order('created_at', { ascending: false }).limit(1).maybeSingle()
    return check<Order | null>(r)
  },
  async order(id: string) {
    return check<Order>(await supabase.from('orders').select('*, lines:order_items(*)').eq('id', id).single())
  },
  watchOrder(id: string, onChange: () => void) {
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, onChange)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },
  async reviewWaiter(orderId: string, stars: number, comment: string) {
    check(await supabase.rpc('review_waiter', { p_order_id: orderId, p_stars: stars, p_comment: comment || null }))
  },
  async rewards() {
    return check<Reward[]>(await supabase.from('rewards').select('*').eq('visible', true).order('sort_order'))
  },
  async pointHistory() {
    return check<PointEntry[]>(await supabase.from('point_entries').select('*').order('created_at', { ascending: false }).limit(50))
  },
  async myStats() {
    return check<GuestStats>(await supabase.rpc('my_stats'))
  },
  async leaderboard(month: string | null) {
    return check<LeaderRow[]>(await supabase.rpc('leaderboard', { p_month: month }))
  },
  async setHideFromLeaderboard(hide: boolean, userId: string) {
    check(await supabase.from('profiles').update({ hide_from_leaderboard: hide }).eq('id', userId))
  },
  // ---- Staff ----
  async orderByCode(code: string) {
    const r = await supabase.from('orders').select('*, lines:order_items(*)').eq('code', code.toUpperCase()).maybeSingle()
    return check<Order | null>(r)
  },
  async confirmOrder(id: string) { check(await supabase.rpc('confirm_order', { p_order_id: id })) },
  async rejectOrder(id: string) { check(await supabase.rpc('reject_order', { p_order_id: id })) },
  // Moves new → preparing → ready → delivered; the database records who delivered it.
  async advanceOrder(id: string) { check(await supabase.rpc('advance_order', { p_order_id: id })) },
  async ordersForDay(day: string) {
    const from = new Date(`${day}T00:00:00`), to = new Date(from.getTime() + 864e5)
    const r = await supabase.from('orders').select('*, lines:order_items(*)')
      .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
      .not('status', 'in', '(waiting,expired)').order('created_at', { ascending: false })
    return check<StaffOrder[]>(r)
  },
  watchOrders(onChange: () => void) {
    const ch = supabase.channel('orders-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  },
  async member(userId: string) {
    return check<MemberSummary | null>(await supabase.rpc('staff_member_summary', { p_user_id: userId }))
  },
  async redeemReward(userId: string, rewardId: string) {
    check(await supabase.rpc('redeem_reward', { p_user_id: userId, p_reward_id: rewardId }))
  },
  async saveCategory(c: Partial<Category>) {
    check(await supabase.from('menu_categories').upsert(c))
  },
  async deleteCategory(id: string) { check(await supabase.from('menu_categories').delete().eq('id', id)) },
  async saveItem(i: Partial<MenuItem>) {
    const { avg_rating: _a, rating_count: _c, ...row } = i
    check(await supabase.from('menu_items').upsert(row))
  },
  async deleteItem(id: string) { check(await supabase.from('menu_items').delete().eq('id', id)) },
  async setAvailable(id: string, available: boolean) {
    check(await supabase.from('menu_items').update({ available }).eq('id', id))
  },

  // ---- Owner and admins ----
  async stats(from: string, to: string) {
    return check<Stats>(await supabase.rpc('admin_stats', { p_from: from, p_to: to }))
  },
  async people(query: string, staffOnly: boolean) {
    return check<Person[]>(await supabase.rpc('admin_people', { p_query: query || null, p_staff_only: staffOnly }))
  },
  async setRole(userId: string, role: Role) { check(await supabase.rpc('set_role', { p_user_id: userId, p_role: role })) },
  async warn(userId: string) { check(await supabase.rpc('warn_nickname', { p_user_id: userId })) },
  async removeWarning(userId: string) { check(await supabase.rpc('remove_warning', { p_user_id: userId })) },
  async ban(userId: string) { check(await supabase.rpc('ban_user', { p_user_id: userId })) },
  async unban(userId: string) { check(await supabase.rpc('unban_user', { p_user_id: userId })) },
  async allRewards() { return check<Reward[]>(await supabase.from('rewards').select('*').order('sort_order')) },
  async saveReward(r: Partial<Reward>) { check(await supabase.from('rewards').upsert(r)) },
  async deleteReward(id: string) { check(await supabase.from('rewards').delete().eq('id', id)) },
  async waiterReviews() {
    return check<WaiterReview[]>(await supabase.from('waiter_reviews_admin').select('*').order('created_at', { ascending: false }))
  },
  async allEvents() { return check<EventItem[]>(await supabase.from('events').select('*').order('date', { ascending: false })) },
  async saveEvent(e: Partial<EventItem>) { check(await supabase.from('events').upsert(e)) },
  async deleteEvent(id: string) { check(await supabase.from('events').delete().eq('id', id)) },
  // Sends a push notification about the event; returns how many devices it reached.
  async notifyEvent(id: string) {
    const r = await supabase.functions.invoke('notify-event', { body: { event_id: id } })
    if (r.error) throw r.error
    return (r.data as { sent: number }).sent
  },
  // Only allowed while the account has a nickname warning.
  async changeNickname(nickname: string) { check(await supabase.rpc('change_nickname', { p_nickname: nickname })) },

  async events() {
    const today = new Date().toISOString().slice(0, 10)
    return check<EventItem[]>(await supabase.from('events').select('*').gte('date', today).order('date').order('time'))
  },
}

export type Api = typeof live
export const api: Api = demo.on ? demo.api : live
