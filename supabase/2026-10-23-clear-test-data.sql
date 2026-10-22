-- Caffe Padrino: a button for the owner account to delete test activity after staff testing.
-- It removes every order, order line, point entry (earned and spent), item rating and waiter
-- review. Accounts, the menu, rewards and events stay. Run once in Supabase › SQL Editor,
-- after 2026-10-22-security.sql. Safe to run again.

create or replace function public.test_data_counts()
returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can do this.';
  end if;
  return jsonb_build_object(
    'orders', (select count(*) from public.orders),
    'points', (select count(*) from public.point_entries),
    'ratings', (select count(*) from public.item_ratings),
    'reviews', (select count(*) from public.waiter_reviews));
end; $function$;

create or replace function public.clear_test_data()
returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can do this.';
  end if;
  result := public.test_data_counts();
  delete from public.waiter_reviews where true;
  delete from public.item_ratings where true;
  delete from public.point_entries where true;
  delete from public.order_items where true;
  delete from public.orders where true;
  return result;
end; $function$;

revoke execute on function public.test_data_counts() from public, anon;
revoke execute on function public.clear_test_data() from public, anon;
grant execute on function public.test_data_counts() to authenticated;
grant execute on function public.clear_test_data() to authenticated;
