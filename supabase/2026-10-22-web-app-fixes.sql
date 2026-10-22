-- Caffe Padrino: database changes for the web app.
-- Run once in Supabase › SQL Editor. Safe to run again.

-- 1. place_order: reject missing, zero, negative or silly quantities.
--    Before this, a negative quantity could lower an order's total.
create or replace function public.place_order(p_table_number integer, p_items jsonb, p_note text default ''::text)
returns public.orders
language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); new_order public.orders; line jsonb; menu_row public.menu_items;
        qty int; total int := 0; new_code text;
begin
  if uid is null then raise exception 'Please log in to order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'The order is empty.'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'The order is too long.'; end if;
  if p_table_number is null or p_table_number not between 1 and 99 then raise exception 'Please enter a table number from 1 to 99.'; end if;
  if (select count(*) from public.orders where customer_id = uid and status = 'rejected'
      and order_day = (now() at time zone 'Europe/Belgrade')::date) >= 3 then
    raise exception 'Ordering is paused for today. Please ask a waiter.'; end if;
  update public.orders set status = 'expired', updated_at = now() where customer_id = uid and status = 'waiting';
  loop
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.orders where code = new_code);
  end loop;
  insert into public.orders (code, customer_id, table_number, note)
  values (new_code, uid, p_table_number, left(coalesce(p_note, ''), 200)) returning * into new_order;
  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line ->> 'quantity')::int;
    if qty is null or qty < 1 or qty > 20 then raise exception 'Each item needs a quantity from 1 to 20.'; end if;
    select * into menu_row from public.menu_items where id = (line ->> 'menu_item_id')::bigint and available;
    if not found then raise exception 'Something in the order is no longer available.'; end if;
    insert into public.order_items (order_id, menu_item_id, name_sr, name_en, price_rsd, quantity)
    values (new_order.id, menu_row.id, menu_row.name_sr, menu_row.name_en, menu_row.price_rsd, qty);
    total := total + menu_row.price_rsd * qty;
  end loop;
  update public.orders set total_rsd = total where id = new_order.id returning * into new_order;
  return new_order;
end; $function$;

-- 2. owner_stats: optional end day, so Statistics can show any single day (p_days = 1, p_end = that day)
--    or a period ending on a chosen day. Calls with only p_days work exactly as before.
drop function if exists public.owner_stats(integer);
create or replace function public.owner_stats(p_days integer, p_end date default null)
returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare today date := least(coalesce(p_end, (now() at time zone 'Europe/Belgrade')::date), (now() at time zone 'Europe/Belgrade')::date);
        since date; result jsonb;
begin
  if not public.is_owner() then raise exception 'Only the owner can see statistics.'; end if;
  since := today - (greatest(least(p_days, 366), 1) - 1);
  with done as (select * from public.orders where status = 'done' and order_day between since and today)
  select jsonb_build_object(
    'revenue', (select coalesce(sum(total_rsd), 0) from done),
    'orders', (select count(*) from done),
    'guests', (select count(distinct customer_id) from done),
    'rejected', (select count(*) from public.orders where status = 'rejected' and order_day between since and today),
    'new_members', (select count(*) from public.profiles where role = 'customer' and (created_at at time zone 'Europe/Belgrade')::date between since and today),
    'points_given', (select coalesce(sum(points), 0) from public.point_entries where reason = 'order' and (created_at at time zone 'Europe/Belgrade')::date between since and today),
    'rewards_used', (select count(*) from public.point_entries where reason = 'reward' and (created_at at time zone 'Europe/Belgrade')::date between since and today),
    'by_day', (select jsonb_agg(jsonb_build_object('day', d::date,
        'revenue', coalesce((select sum(total_rsd) from done where order_day = d::date), 0),
        'orders', (select count(*) from done where order_day = d::date)) order by d)
      from generate_series(since, today, interval '1 day') d),
    'by_hour', (select jsonb_agg(jsonb_build_object('hour', h,
        'orders', (select count(*) from done where extract(hour from coalesce(confirmed_at, created_at) at time zone 'Europe/Belgrade') = h)) order by h)
      from generate_series(0, 23) h),
    'top_items', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.quantity desc) from (
        select i.name_sr, i.name_en, sum(i.quantity)::int as quantity, sum(i.quantity * i.price_rsd)::int as revenue
        from public.order_items i join done o on o.id = i.order_id
        group by i.name_sr, i.name_en order by sum(i.quantity) desc limit 8) t), '[]'::jsonb),
    'top_rated', coalesce((select jsonb_agg(row_to_json(r)::jsonb order by r.average desc, r.count desc) from (
        select m.name_sr, m.name_en, round(avg(r.stars), 1) as average, count(*)::int as count
        from public.item_ratings r join public.menu_items m on m.id = r.menu_item_id
        group by m.id order by avg(r.stars) desc, count(*) desc limit 5) r), '[]'::jsonb)
  ) into result;
  return result;
end; $function$;

-- Supabase's API only sees new functions after a schema reload.
notify pgrst, 'reload schema';
