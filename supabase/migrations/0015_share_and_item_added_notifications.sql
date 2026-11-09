-- ============================================================================
-- 0015 — notify people when a list is shared with them, and when a new item is
-- added to a list already shared with them.
--   Extends the notification center (0014). Same privacy posture: notifications
--   are created by SECURITY DEFINER triggers and owned by the recipient; the
--   owner's action returns no recipient data and an error can never block it.
--   No claim data is involved here (sharing + item adds are visible to givers
--   anyway), so the owner-blindness invariant is untouched.
-- Purely additive: two triggers + one helper. No existing row changed.
-- ============================================================================

-- Everyone (by user id) who currently has access to a list via a share:
-- direct user shares, email shares that match a real account, and members of a
-- group the list is shared with. Used to fan out "new item" notifications.
create or replace function public.list_shared_user_ids(p_list_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct uid from (
    select s.shared_with_user_id as uid
      from public.list_shares s
      where s.list_id = p_list_id and s.shared_with_user_id is not null
    union
    select p.id
      from public.list_shares s
      join public.profiles p on lower(p.email) = lower(s.shared_with_email)
      where s.list_id = p_list_id and s.shared_with_email is not null
    union
    select m.user_id
      from public.list_shares s
      join public.group_members m on m.group_id = s.shared_with_group_id
      where s.list_id = p_list_id and s.shared_with_group_id is not null
        and m.status = 'active' and m.user_id is not null
  ) q
  where uid is not null;
$$;

-- A list was shared → notify the people that specific share reaches.
create or replace function public.notify_list_shared()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_owner_name text;
begin
  select owner_id, title into v_owner, v_title from public.lists where id = NEW.list_id;
  select display_name into v_owner_name from public.profiles where id = v_owner;
  insert into public.notifications (user_id, type, list_id, title, body)
  select distinct uid, 'list_shared', NEW.list_id, v_title,
    coalesce(v_owner_name, 'Someone') || ' shared “' || coalesce(v_title, 'a list') || '” with you.'
  from (
    select NEW.shared_with_user_id as uid
    union
    select p.id from public.profiles p
      where NEW.shared_with_email is not null and lower(p.email) = lower(NEW.shared_with_email)
    union
    select m.user_id from public.group_members m
      where NEW.shared_with_group_id is not null and m.group_id = NEW.shared_with_group_id
        and m.status = 'active' and m.user_id is not null
  ) r(uid)
  where uid is not null and uid <> v_owner;
  return NEW;
exception when others then
  return NEW;
end $$;

drop trigger if exists trg_notify_list_shared on public.list_shares;
create trigger trg_notify_list_shared
  after insert on public.list_shares
  for each row execute function public.notify_list_shared();

-- A new item was added → notify everyone the list is already shared with.
create or replace function public.notify_item_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_owner_name text;
begin
  if NEW.deleted_at is not null then return NEW; end if;
  select owner_id, title into v_owner, v_title from public.lists where id = NEW.list_id;
  select display_name into v_owner_name from public.profiles where id = v_owner;
  insert into public.notifications (user_id, type, list_id, item_id, title, body)
  select uid, 'item_added', NEW.list_id, NEW.id, NEW.title,
    coalesce(v_owner_name, 'Someone') || ' added “' || coalesce(NEW.title, 'a gift') || '” to “' || coalesce(v_title, 'a list') || '”.'
  from public.list_shared_user_ids(NEW.list_id) uid
  where uid <> v_owner;
  return NEW;
exception when others then
  return NEW;
end $$;

drop trigger if exists trg_notify_item_added on public.list_items;
create trigger trg_notify_item_added
  after insert on public.list_items
  for each row execute function public.notify_item_added();
