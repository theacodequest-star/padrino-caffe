-- Caffe Padrino: database locks, so the app's rules hold even for someone who sends their own
-- requests (for example from the browser's developer tools) instead of using the app's buttons.
-- Run once in Supabase › SQL Editor, after 2026-10-22-emails-and-admins.sql and
-- 2026-10-22-menu-managers-only.sql. Safe to run again.
--
-- How the locks tell people apart: a request from the website runs as the database role
-- "anon" (logged out) or "authenticated" (logged in). The app's own functions (place_order,
-- confirm_order, ban_member, ...) run as their owner, and the Supabase dashboard runs as
-- "postgres", so neither is stopped here. The lock functions are deliberately not
-- "security definer": they must see who is really asking.

create or replace function public.from_website()
returns boolean
language sql stable set search_path to '' as $function$
  select current_user in ('anon', 'authenticated');
$function$;

-- 1. Profiles: from the website a person may change only their own row, and only the
--    harmless fields. Role, warnings, bans, points and dates go through the app's functions.
create or replace function public.guard_profile_writes()
returns trigger
language plpgsql set search_path to '' as $function$
begin
  if not public.from_website() then return coalesce(new, old); end if;
  if tg_op <> 'UPDATE' or auth.uid() is null or old.id <> auth.uid() then
    raise exception 'Not allowed.';
  end if;
  if new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.created_at is distinct from old.created_at
    or new.last_seen_at is distinct from old.last_seen_at
    or new.nickname_warned_at is distinct from old.nickname_warned_at
    or new.nickname_deadline is distinct from old.nickname_deadline
    or new.nickname_reminders_sent is distinct from old.nickname_reminders_sent
    or new.banned_at is distinct from old.banned_at then
    raise exception 'Not allowed.';
  end if;
  -- The birth year is set once, when the profile is completed.
  if old.birth_year is not null and new.birth_year is distinct from old.birth_year then
    raise exception 'Not allowed.';
  end if;
  if new.birth_year is not null and (new.birth_year < 1900 or extract(year from now())::int - new.birth_year < 13) then
    raise exception 'You must be at least 13 years old to join.';
  end if;
  if length(coalesce(new.nickname, '')) > 24 or length(coalesce(new.name, '')) > 80 then
    raise exception 'Too long.';
  end if;
  if new.language is distinct from old.language and new.language not in ('sr', 'en') then
    raise exception 'Not allowed.';
  end if;
  return new;
end; $function$;

drop trigger if exists guard_profile_writes on public.profiles;
create trigger guard_profile_writes before insert or update or delete on public.profiles
  for each row execute function public.guard_profile_writes();

-- 2. Orders, points, ratings, reviews and the email queue change only through the app's
--    functions, which check who is asking and what is allowed (a guest can't mark an order
--    done, give themselves points or rate twice).
create or replace function public.guard_function_only()
returns trigger
language plpgsql set search_path to '' as $function$
begin
  if public.from_website() then raise exception 'Not allowed.'; end if;
  return coalesce(new, old);
end; $function$;

do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'point_entries', 'item_ratings', 'waiter_reviews',
                           'banned_emails', 'email_outbox', 'push_subscriptions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
      execute format('drop trigger if exists guard_function_only on public.%I', t);
      execute format('create trigger guard_function_only before insert or update or delete on public.%I
                      for each row execute function public.guard_function_only()', t);
    end if;
  end loop;
end $$;

-- 3. Menu, rewards and events: only the owner and admins. This replaces the menu lock from
--    2026-10-22-menu-managers-only.sql, which let a logged-out request through.
create or replace function public.protect_menu_edits()
returns trigger
language plpgsql set search_path to '' as $function$
begin
  if public.from_website() and not public.is_manager() then
    raise exception 'Only the owner and admins can change this.';
  end if;
  return coalesce(new, old);
end; $function$;

do $$
declare t text;
begin
  foreach t in array array['menu_categories', 'menu_items', 'rewards', 'events'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists protect_menu_edits on public.%I', t);
      execute format('create trigger protect_menu_edits before insert or update or delete on public.%I
                      for each row execute function public.protect_menu_edits()', t);
    end if;
  end loop;
end $$;

-- 4. Logged-out visitors can't call the functions that need an account at all.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = any (array[
             'place_order', 'cancel_order', 'rate_item', 'review_waiter', 'confirm_order', 'set_order_status',
             'redeem_reward', 'points_balance', 'is_blocked', 'my_family_standing', 'order_waiter',
             'owner_stats', 'list_members', 'set_member_role', 'warn_nickname', 'ban_member', 'lift_moderation',
             'waiter_reviews', 'announce_event', 'event_audience', 'touch_last_seen'])
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
