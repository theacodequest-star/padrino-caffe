-- Caffe Padrino: only the owner and admins may change the menu (categories and items, including
-- marking an item unavailable). Waiters can still see it. Run once in Supabase › SQL Editor,
-- after 2026-10-22-emails-and-admins.sql (it uses is_manager()). Safe to run again.

create or replace function public.protect_menu_edits()
returns trigger
language plpgsql security definer set search_path to '' as $function$
begin
  -- Dashboard changes have no signed-in app user.
  if auth.uid() is not null and not public.is_manager() then
    raise exception 'Only the owner and admins can change the menu.';
  end if;
  return coalesce(new, old);
end; $function$;

drop trigger if exists protect_menu_edits on public.menu_items;
create trigger protect_menu_edits before insert or update or delete on public.menu_items
  for each row execute function public.protect_menu_edits();

drop trigger if exists protect_menu_edits on public.menu_categories;
create trigger protect_menu_edits before insert or update or delete on public.menu_categories
  for each row execute function public.protect_menu_edits();
