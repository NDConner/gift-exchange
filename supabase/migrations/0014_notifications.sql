-- ============================================================================
-- 0014 — notification center.
--   When a list OWNER edits an item (or sub-item) that someone has already
--   claimed/purchased, that claimer gets a notification. Only claimers are
--   notified — never anyone else.
--
--   PRIVACY: notifications are created by a SECURITY DEFINER trigger that reads
--   the claims table and inserts rows owned by the CLAIMER. The owner's edit
--   just fires the trigger as a silent side-effect and learns nothing — it
--   returns no claim data, and the trigger swallows any error so an edit can
--   never fail (or behave differently) because of who claimed. Each notification
--   row is owned by its recipient; RLS lets only that recipient read it. The
--   owner-blindness invariant is untouched.
--
--   Purely additive: new table + triggers only. No existing row is changed and
--   no past edit is backfilled.
-- ============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null,                     -- 'item_changed' | 'option_changed'
  list_id      uuid references public.lists (id) on delete cascade,
  item_id      uuid references public.list_items (id) on delete set null,
  option_id    uuid references public.list_item_options (id) on delete set null,
  title        text,                              -- short label (item/sub-item name at change time)
  body         text not null,                     -- human message
  read_at      timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, archived_at, read_at, created_at desc);

alter table public.notifications enable row level security;

-- A recipient can read and update (mark read / archive) only their own.
-- No insert/delete policy for end users: rows are created solely by the
-- SECURITY DEFINER trigger below, which bypasses RLS.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Item-level change → notify everyone who claimed anything on that item.
-- ----------------------------------------------------------------------------
create or replace function public.notify_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.title is distinct from NEW.title
     or OLD.description is distinct from NEW.description
     or OLD.url is distinct from NEW.url
     or OLD.links is distinct from NEW.links
     or OLD.image_url is distinct from NEW.image_url then
    insert into public.notifications (user_id, type, list_id, item_id, title, body)
    select distinct c.claimer_id, 'item_changed', NEW.list_id, NEW.id, NEW.title,
      case when OLD.title is distinct from NEW.title
        then 'An item you claimed was renamed from “' || coalesce(OLD.title, '') || '” to “' || coalesce(NEW.title, '') || '”.'
        else 'An item you claimed was updated: “' || coalesce(NEW.title, '') || '”.'
      end
    from public.claims c
    where c.item_id = NEW.id and c.claimer_id is not null;
  end if;
  return NEW;
exception when others then
  return NEW; -- never let notifications break an edit
end $$;

drop trigger if exists trg_notify_item_change on public.list_items;
create trigger trg_notify_item_change
  after update on public.list_items
  for each row execute function public.notify_item_change();

-- ----------------------------------------------------------------------------
-- Sub-item change → notify whoever claimed that specific sub-item.
-- ----------------------------------------------------------------------------
create or replace function public.notify_option_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_list_id uuid;
begin
  if OLD.name is distinct from NEW.name
     or OLD.note is distinct from NEW.note
     or OLD.url is distinct from NEW.url
     or OLD.image_url is distinct from NEW.image_url then
    select list_id into v_list_id from public.list_items where id = NEW.item_id;
    insert into public.notifications (user_id, type, list_id, item_id, option_id, title, body)
    select distinct c.claimer_id, 'option_changed', v_list_id, NEW.item_id, NEW.id,
      coalesce(NEW.name, NEW.note, 'Sub-item'),
      case when OLD.name is distinct from NEW.name
        then 'A sub-item you claimed was renamed from “' || coalesce(OLD.name, '') || '” to “' || coalesce(NEW.name, '') || '”.'
        else 'A sub-item you claimed was updated: “' || coalesce(NEW.name, NEW.note, '') || '”.'
      end
    from public.claims c
    where c.option_id = NEW.id and c.claimer_id is not null;
  end if;
  return NEW;
exception when others then
  return NEW;
end $$;

drop trigger if exists trg_notify_option_change on public.list_item_options;
create trigger trg_notify_option_change
  after update on public.list_item_options
  for each row execute function public.notify_option_change();
