-- Caffe Padrino: read-only security check. It changes nothing. Run in Supabase › SQL Editor
-- and send the result rows to Claude.
select 'rls' as kind, c.relname as name,
       case when c.relrowsecurity then 'on' else 'OFF' end as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select 'policy', tablename || ' / ' || policyname,
       cmd || ' to ' || array_to_string(roles, ',') || ' using (' || coalesce(qual, '') || ') check (' || coalesce(with_check, '') || ')'
from pg_policies where schemaname = 'public'
union all
select 'grant', table_name, grantee || ': ' || string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee
union all
select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       case when p.prosecdef then 'definer' else 'invoker' end
       || case when has_function_privilege('anon', p.oid, 'execute') then ', anon can run' else '' end
       || case when p.prosecdef and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') then ', NO search_path' else '' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'trigger', c.relname || ' / ' || t.tgname, ''
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
union all
select 'function body', p.proname, regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('redeem_reward', 'set_member_role', 'warn_nickname', 'ban_member',
  'check_moderation_target', 'cancel_order', 'rate_item', 'review_waiter', 'list_members', 'leaderboard',
  'points_balance', 'is_owner', 'is_staff', 'nickname_taken')
order by 1, 2;
