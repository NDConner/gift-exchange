-- ============================================================================
-- 0016 — Gift Giving List: a giver's private budget/purchase tracker.
--   Per year, the giver lists people they're buying for (optionally linked to
--   that person's Wishing Well list), sets a budget per person, and logs gift
--   line items with an amount + status. Budget-vs-actual + analytics are
--   computed from this.
--
--   This is the GIVER'S OWN private data — RLS scopes every row to the giver
--   (user_id = auth.uid()); no one else can read it. It does NOT expose claims
--   to list owners (the giver is recording their own spend privately), so the
--   owner-blindness invariant is untouched. Purely additive: two new tables.
-- ============================================================================

create table if not exists public.gift_recipients (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,  -- the giver
  year           int  not null,
  name           text not null,
  group_label    text,
  linked_list_id uuid references public.lists (id) on delete set null,
  budget         numeric(12,2),
  position       int  not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists gift_recipients_user_year_idx on public.gift_recipients (user_id, year);

create table if not exists public.gift_purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,     -- the giver (denormalized for RLS)
  recipient_id uuid not null references public.gift_recipients (id) on delete cascade,
  claim_id     uuid references public.claims (id) on delete set null,          -- set when this annotates a Wishing Well claim
  name         text,
  amount       numeric(12,2),
  status       text not null default 'idea' check (status in ('idea','purchased','wrapped','given')),
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists gift_purchases_recipient_idx on public.gift_purchases (recipient_id);
create index if not exists gift_purchases_claim_idx on public.gift_purchases (claim_id);

alter table public.gift_recipients enable row level security;
alter table public.gift_purchases enable row level security;

drop policy if exists gift_recipients_own on public.gift_recipients;
create policy gift_recipients_own on public.gift_recipients
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gift_purchases_own on public.gift_purchases;
create policy gift_purchases_own on public.gift_purchases
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
