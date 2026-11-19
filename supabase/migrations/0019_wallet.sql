-- ============================================================================
-- 0019 — Buyer Wallet (Coupon Overview): a user's private store of coupons,
-- promo codes, gift cards, and credits.
--   * wallet_items (one per code) + wallet_redemptions (decrement/usage log).
--   * All private per user (RLS user_id = auth.uid()), same pattern as
--     gift_recipients / contacts.
--   * New PRIVATE Storage bucket `wallet-scans` for photos of codes/cards
--     (owner-only read AND write — unlike the public item-images bucket).
--   NOTE: codes are stored as plaintext here for the initial single-user test,
--   protected by strict RLS + a private bucket. Encryption-at-rest (app-layer
--   AES or pgcrypto + a Render secret) MUST land before other users store real
--   cash-equivalent cards. Purely additive: no existing row is modified.
-- ============================================================================

create table if not exists public.wallet_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null default 'coupon' check (kind in ('coupon','gift_card','store_credit','loyalty','other')),
  brand          text,
  brand_domain   text,                 -- normalized host (e.g. "quince.com") for matching
  brand_logo_url text,
  code           text,                 -- the coupon/gift-card code or number
  pin            text,
  barcode_value  text,                 -- raw value to render as a barcode/QR (often = code)
  barcode_format text,                 -- 'qr' | 'code128' | 'upc' | ... (hint for rendering)
  value_initial  numeric(12,2),
  value_remaining numeric(12,2),
  currency       text default 'USD',
  discount_type  text check (discount_type in ('amount','percent')),  -- for coupons
  category       text,
  notes          text,
  image_path     text,                 -- path in the private wallet-scans bucket
  valid_from     date,
  expires_at     date,
  status         text not null default 'active' check (status in ('active','used','expired','archived')),
  created_at     timestamptz not null default now()
);
create index if not exists wallet_items_user_idx on public.wallet_items (user_id, status, expires_at);
create index if not exists wallet_items_brand_idx on public.wallet_items (user_id, brand_domain);

create table if not exists public.wallet_redemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  wallet_item_id uuid not null references public.wallet_items (id) on delete cascade,
  amount         numeric(12,2),
  note           text,
  redeemed_at    timestamptz not null default now()
);
create index if not exists wallet_redemptions_item_idx on public.wallet_redemptions (wallet_item_id);

alter table public.wallet_items enable row level security;
alter table public.wallet_redemptions enable row level security;

drop policy if exists wallet_items_own on public.wallet_items;
create policy wallet_items_own on public.wallet_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists wallet_redemptions_own on public.wallet_redemptions;
create policy wallet_redemptions_own on public.wallet_redemptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for scanned code/card photos. Owner-only on ALL operations.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wallet-scans', 'wallet-scans', false, 15728640, array['image/*'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = array['image/*'];

drop policy if exists "wallet_scans_read" on storage.objects;
create policy "wallet_scans_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'wallet-scans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallet_scans_insert" on storage.objects;
create policy "wallet_scans_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wallet-scans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallet_scans_update" on storage.objects;
create policy "wallet_scans_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'wallet-scans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wallet-scans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wallet_scans_delete" on storage.objects;
create policy "wallet_scans_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wallet-scans' and (storage.foldername(name))[1] = auth.uid()::text);
