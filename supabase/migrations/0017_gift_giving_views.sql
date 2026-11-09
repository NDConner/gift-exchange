-- ============================================================================
-- 0017 — Gift Giving List enhancements: per-person completion status + clue-hunt
-- flag, and per-gift kind (stocking vs full gift) + clue-hunt flag.
-- Purely additive: new nullable/defaulted columns only; existing rows keep the
-- sensible defaults (in_progress / full gift / not a clue hunt).
-- ============================================================================

alter table public.gift_recipients
  add column if not exists status text not null default 'in_progress'
    check (status in ('in_progress', 'complete')),
  add column if not exists clue_hunt boolean not null default false;

alter table public.gift_purchases
  add column if not exists kind text not null default 'full'
    check (kind in ('full', 'stocking')),
  add column if not exists clue_hunt boolean not null default false;
