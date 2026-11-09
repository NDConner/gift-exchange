-- ============================================================================
-- 0018 — saved contacts: remember people you share with / are grouped with so
-- you can pick them instead of retyping an email every time.
--   Private per user (RLS user_id = auth.uid()). Auto-populated by the share /
--   invite actions going forward, and backfilled below from existing shares and
--   group memberships. A new convenience table only — no existing list, share,
--   group, or profile row is modified.
-- ============================================================================

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,  -- whose address book
  email           text not null,                                              -- contact's email (lowercased)
  contact_user_id uuid references auth.users (id) on delete set null,          -- resolved account, if any
  display_name    text,
  created_at      timestamptz not null default now(),
  unique (user_id, email)
);
create index if not exists contacts_user_idx on public.contacts (user_id);

alter table public.contacts enable row level security;
drop policy if exists contacts_own on public.contacts;
create policy contacts_own on public.contacts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Backfill: people you've shared a list you OWN with (by email or account).
insert into public.contacts (user_id, email, contact_user_id, display_name)
select l.owner_id, lower(s.shared_with_email), p.id, p.display_name
from public.list_shares s
join public.lists l on l.id = s.list_id
left join public.profiles p on lower(p.email) = lower(s.shared_with_email)
where s.shared_with_email is not null and l.owner_id is not null
on conflict (user_id, email) do nothing;

insert into public.contacts (user_id, email, contact_user_id, display_name)
select l.owner_id, lower(p.email), p.id, p.display_name
from public.list_shares s
join public.lists l on l.id = s.list_id
join public.profiles p on p.id = s.shared_with_user_id
where s.shared_with_user_id is not null and l.owner_id is not null and p.email is not null
on conflict (user_id, email) do nothing;

-- Backfill: the other members of groups you're in.
insert into public.contacts (user_id, email, contact_user_id, display_name)
select mine.user_id, lower(p.email), p.id, p.display_name
from public.group_members mine
join public.group_members other
  on other.group_id = mine.group_id and other.user_id <> mine.user_id
join public.profiles p on p.id = other.user_id
where mine.user_id is not null and other.user_id is not null and p.email is not null
on conflict (user_id, email) do nothing;
