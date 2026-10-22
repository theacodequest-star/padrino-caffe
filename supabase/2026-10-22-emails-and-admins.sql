-- Caffe Padrino: emails instead of push notifications, admins for statistics and events,
-- and activity tracking. Run once in Supabase › SQL Editor, after 2026-10-22-web-app-fixes.sql.
-- Safe to run again.

-- 1. Admins count as managers next to the owner.
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('owner', 'admin') and banned_at is null);
$function$;

-- 2. Statistics: the same as before, open to admins too.
create or replace function public.owner_stats(p_days integer, p_end date default null)
returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare today date := least(coalesce(p_end, (now() at time zone 'Europe/Belgrade')::date), (now() at time zone 'Europe/Belgrade')::date);
        since date; result jsonb;
begin
  if not public.is_manager() then raise exception 'Only the owner and admins can see statistics.'; end if;
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

-- 3. Activity and email preferences on each profile.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists event_emails boolean not null default true;
alter table public.events add column if not exists announced_at timestamptz;

-- The app calls this when it opens. At most one write per person per hour.
create or replace function public.touch_last_seen()
returns void
language sql security definer set search_path to '' as $function$
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
$function$;

-- Someone counts as active from their last visit, last order or sign-up, whichever is latest.
create or replace function public.last_active(p_user_id uuid)
returns timestamptz
language sql stable security definer set search_path to '' as $function$
  select greatest(p.last_seen_at, p.created_at,
                  (select max(o.created_at) from public.orders o where o.customer_id = p.id))
  from public.profiles p where p.id = p_user_id;
$function$;
revoke execute on function public.last_active(uuid) from public, anon, authenticated;

-- 4. Outgoing emails wait here until the send-emails function sends them.
create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  to_email text not null,
  kind text not null,               -- 'event', 'warning' or 'ban'
  subject text not null,
  body text not null,               -- plain text; {{APP_URL}} becomes the app's address
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts int not null default 0,
  sent_at timestamptz,
  last_error text
);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
create index if not exists email_outbox_unsent on public.email_outbox (id) where sent_at is null;

-- The sender takes a batch at a time; skip locked so two runs never send the same email.
create or replace function public.claim_emails(p_limit integer)
returns setof public.email_outbox
language sql security definer set search_path to '' as $function$
  update public.email_outbox set claimed_at = now(), attempts = attempts + 1
  where id in (select id from public.email_outbox
               where sent_at is null and attempts < 5
                 and (claimed_at is null or claimed_at < now() - interval '10 minutes')
               order by id limit greatest(p_limit, 0)
               for update skip locked)
  returning *;
$function$;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;

-- 5. Announce an event by email to people active in the last p_active_days days who haven't
--    turned event emails off. Returns how many emails were queued. Each event goes out once.
drop function if exists public.announce_event(bigint);
create or replace function public.announce_event(p_event_id bigint, p_active_days integer default 60)
returns integer
language plpgsql security definer set search_path to '' as $function$
declare event_row public.events; queued int;
begin
  if not public.is_manager() then raise exception 'Only the owner and admins can announce events.'; end if;
  select * into event_row from public.events where id = p_event_id for update;
  if not found then raise exception 'No such event.'; end if;
  if event_row.announced_at is not null then raise exception 'ALREADY_ANNOUNCED'; end if;
  insert into public.email_outbox (user_id, to_email, kind, subject, body)
  select p.id, u.email, 'event',
    case when p.language = 'en' then 'Caffe Padrino: ' || event_row.title_en
         else 'Caffe Padrino: ' || event_row.title_sr end,
    case when p.language = 'en' then
      event_row.title_en || E'\n' || to_char(event_row.starts_at at time zone 'Europe/Belgrade', 'DD.MM.YYYY. "at" HH24:MI') || E'\n\n'
      || coalesce(nullif(event_row.description_en, '') || E'\n\n', '')
      || E'See you at Caffe Padrino.\n{{APP_URL}}/events\n\n'
      || 'You get this because you turned on event emails. You can turn them off in the app on the Events page.'
    else
      event_row.title_sr || E'\n' || to_char(event_row.starts_at at time zone 'Europe/Belgrade', 'DD.MM.YYYY. "u" HH24:MI') || E'\n\n'
      || coalesce(nullif(event_row.description_sr, '') || E'\n\n', '')
      || E'Vidimo se u Caffe Padrino.\n{{APP_URL}}/events\n\n'
      || 'Ovaj mejl dobijaš jer su ti uključeni mejlovi o događajima. Možeš ih isključiti u aplikaciji na stranici Događaji.'
    end
  from public.profiles p join auth.users u on u.id = p.id
  where p.event_emails and p.banned_at is null and coalesce(u.email, '') <> ''
    and public.last_active(p.id) >= now() - make_interval(days => greatest(coalesce(p_active_days, 60), 1));
  get diagnostics queued = row_count;
  update public.events set announced_at = now() where id = p_event_id;
  return queued;
end; $function$;

-- How many people an announcement would reach, so the app can show it before sending.
create or replace function public.event_audience(p_active_days integer default 60)
returns integer
language sql stable security definer set search_path to '' as $function$
  select case when public.is_manager() then (
    select count(*)::int from public.profiles p join auth.users u on u.id = p.id
    where p.event_emails and p.banned_at is null and coalesce(u.email, '') <> ''
      and public.last_active(p.id) >= now() - make_interval(days => greatest(coalesce(p_active_days, 60), 1)))
  end;
$function$;

-- 6. Nickname warnings and bans are emailed to the person straight away.
create or replace function public.queue_moderation_email()
returns trigger
language plpgsql security definer set search_path to '' as $function$
declare addr text; en boolean := new.language = 'en';
begin
  select email into addr from auth.users where id = new.id;
  if coalesce(addr, '') = '' then return new; end if;
  if new.banned_at is not null and old.banned_at is null then
    insert into public.email_outbox (user_id, to_email, kind, subject, body) values (new.id, addr, 'ban',
      case when en then 'Caffe Padrino: your account is blocked' else 'Caffe Padrino: tvoj nalog je blokiran' end,
      case when en then E'Your Caffe Padrino account has been blocked. If you think this is a mistake, please talk to us at the cafe.'
           else E'Tvoj Caffe Padrino nalog je blokiran. Ako misliš da je u pitanju greška, javi nam se u kafiću.' end);
  elsif new.nickname_deadline is not null and old.nickname_deadline is null and new.banned_at is null then
    insert into public.email_outbox (user_id, to_email, kind, subject, body) values (new.id, addr, 'warning',
      case when en then 'Caffe Padrino: please change your nickname' else 'Caffe Padrino: promeni nadimak' end,
      case when en then
        'Your nickname "' || coalesce(new.nickname, '') || '" breaks the Caffe Padrino rules. Please change it in the app by '
        || to_char(new.nickname_deadline at time zone 'Europe/Belgrade', 'DD.MM.YYYY. "at" HH24:MI')
        || E', or your account will be blocked.\n\n{{APP_URL}}'
      else
        'Tvoj nadimak „' || coalesce(new.nickname, '') || '” nije u skladu s pravilima Caffe Padrino. Promeni ga u aplikaciji do '
        || to_char(new.nickname_deadline at time zone 'Europe/Belgrade', 'DD.MM.YYYY. "u" HH24:MI')
        || E', inače će nalog biti blokiran.\n\n{{APP_URL}}'
      end);
  end if;
  return new;
end; $function$;

drop trigger if exists queue_moderation_email on public.profiles;
create trigger queue_moderation_email after update of nickname_deadline, banned_at on public.profiles
  for each row execute function public.queue_moderation_email();

-- 7. Every 5 minutes, if anything is waiting, ask the send-emails function to send it.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('send-emails', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://huuaoukchsvejkjvmrtl.supabase.co/functions/v1/send-emails',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  where exists (select 1 from public.email_outbox where sent_at is null and attempts < 5);
$cron$);

-- Supabase's API only sees new functions after a schema reload.
notify pgrst, 'reload schema';
