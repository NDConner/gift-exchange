"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Gift, Plus, Trash2, Wallet, X } from "lucide-react";
import {
  GIFT_STATUS_LABELS,
  type GiftPurchase,
  type GiftRecipient,
  type GiftStatus,
} from "@/lib/types";
import {
  addManualGift,
  addRecipient,
  deleteGift,
  deleteRecipient,
  updateGift,
  updateRecipient,
  upsertClaimGift,
} from "./actions";

export type ClaimedGift = { claim_id: string; label: string; ww_status: "planning" | "purchased" };
export type LinkableList = { id: string; title: string; owner_name: string };

const STATUSES: GiftStatus[] = ["idea", "purchased", "wrapped", "given"];
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (v: string): number | null => {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function GiftGiving({
  year,
  years,
  recipients,
  purchasesByRecipient,
  claimedGiftsByList,
  lists,
}: {
  year: number;
  years: number[];
  recipients: GiftRecipient[];
  purchasesByRecipient: Record<string, GiftPurchase[]>;
  claimedGiftsByList: Record<string, ClaimedGift[]>;
  lists: LinkableList[];
}) {
  const router = useRouter();
  const [recips, setRecips] = useState(recipients);
  const [pmap, setPmap] = useState(purchasesByRecipient);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(String(Math.max(...years) + 1));
  // add-person form
  const [pName, setPName] = useState("");
  const [pGroup, setPGroup] = useState("");
  const [pList, setPList] = useState("");
  const [pBudget, setPBudget] = useState("");

  const giftsOf = (rid: string) => pmap[rid] ?? [];
  const spentOf = (rid: string) => giftsOf(rid).reduce((s, p) => s + (p.amount ?? 0), 0);
  const claimPurchase = (rid: string, claimId: string) => giftsOf(rid).find((p) => p.claim_id === claimId);
  const manualGifts = (rid: string) => giftsOf(rid).filter((p) => !p.claim_id);

  const totalBudget = recips.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = recips.reduce((s, r) => s + spentOf(r.id), 0);
  const remaining = totalBudget - totalSpent;
  const giftCount = recips.reduce((s, r) => s + giftsOf(r.id).length, 0);
  const purchasedCount = recips.reduce(
    (s, r) => s + giftsOf(r.id).filter((p) => p.status !== "idea").length,
    0,
  );

  function upsertPmap(rid: string, row: GiftPurchase) {
    setPmap((prev) => {
      const arr = (prev[rid] ?? []).slice();
      const i = arr.findIndex((p) => p.id === row.id);
      if (i === -1) arr.push(row);
      else arr[i] = row;
      return { ...prev, [rid]: arr };
    });
  }
  function removePmap(rid: string, id: string) {
    setPmap((prev) => ({ ...prev, [rid]: (prev[rid] ?? []).filter((p) => p.id !== id) }));
  }

  function goYear(y: number) {
    router.push(`/gift-giving?year=${y}`);
  }

  async function onAddPerson(e: React.FormEvent) {
    e.preventDefault();
    const name = pName.trim();
    if (!name) return;
    const r = await addRecipient({
      year,
      name,
      group_label: pGroup || null,
      linked_list_id: pList || null,
      budget: num(pBudget),
    });
    if (r?.recipient) {
      setRecips((prev) => [...prev, r.recipient as GiftRecipient]);
      setPName("");
      setPGroup("");
      setPList("");
      setPBudget("");
      if (pList) router.refresh(); // pull that person's claimed gifts
    }
  }

  async function onChangeLink(r: GiftRecipient, listId: string) {
    setRecips((prev) => prev.map((x) => (x.id === r.id ? { ...x, linked_list_id: listId || null } : x)));
    await updateRecipient(r.id, { linked_list_id: listId || null });
    router.refresh(); // re-pull claimed gifts for the new link
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <Wallet className="h-7 w-7 text-brand" /> Gift Giving
          </h1>
          <p className="mt-1 text-muted-foreground">Track who you&rsquo;re buying for, your budget, and what you&rsquo;ve spent.</p>
        </div>
        {/* Year switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => goYear(y)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                y === year ? "bg-brand text-brand-foreground" : "border border-border bg-card hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
          {addingYear ? (
            <span className="inline-flex items-center gap-1">
              <input
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={() => num(newYear) && goYear(Math.trunc(num(newYear)!))}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:bg-brand-strong"
              >
                Go
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAddingYear(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Year
            </button>
          )}
        </div>
      </div>

      {/* Analytics */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Budget" value={money(totalBudget)} />
        <StatTile label="Spent" value={money(totalSpent)} tone="brand" />
        <StatTile
          label={remaining >= 0 ? "Left to spend" : "Over budget"}
          value={money(Math.abs(remaining))}
          tone={remaining >= 0 ? "accent" : "danger"}
        />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {recips.length} {recips.length === 1 ? "person" : "people"} · {purchasedCount}/{giftCount} gifts bought
          </span>
          <span className="text-muted-foreground">
            {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget` : "No budget set"}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${remaining >= 0 ? "bg-brand" : "bg-brand-strong"}`}
            style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }}
          />
        </div>
        {/* Per-person bars */}
        {recips.length > 0 && (
          <div className="mt-4 space-y-2">
            {recips.map((r) => {
              const spent = spentOf(r.id);
              const bud = r.budget ?? 0;
              const pct = bud > 0 ? Math.min(100, (spent / bud) * 100) : spent > 0 ? 100 : 0;
              const over = bud > 0 && spent > bud;
              return (
                <div key={r.id} className="flex items-center gap-3 text-xs">
                  <span className="w-28 flex-none truncate text-foreground">{r.name}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-brand-strong" : "bg-accent"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-28 flex-none text-right text-muted-foreground">
                    {money(spent)}{bud > 0 ? ` / ${money(bud)}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add person */}
      <form onSubmit={onAddPerson} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Who are you buying for?</span>
          <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Nick Conner"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Group</span>
          <input value={pGroup} onChange={(e) => setPGroup(e.target.value)} placeholder="Family"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
        </label>
        <label className="flex w-44 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Their list (optional)</span>
          <select value={pList} onChange={(e) => setPList(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring">
            <option value="">—</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.title} ({l.owner_name})</option>)}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Budget</span>
          <input value={pBudget} onChange={(e) => setPBudget(e.target.value)} placeholder="$"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
        </label>
        <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {/* Recipients */}
      <div className="mt-6 space-y-4">
        {recips.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Gift className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 font-medium text-foreground">No one added for {year} yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add the people you&rsquo;re buying for above.</p>
          </div>
        )}
        {recips.map((r) => {
          const claimed = r.linked_list_id ? claimedGiftsByList[r.linked_list_id] ?? [] : [];
          const manual = manualGifts(r.id);
          const spent = spentOf(r.id);
          const over = (r.budget ?? 0) > 0 && spent > (r.budget ?? 0);
          const linkedList = lists.find((l) => l.id === r.linked_list_id);
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-card-foreground">{r.name}</h3>
                    {r.group_label && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{r.group_label}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 text-muted-foreground">
                      List:
                      <select
                        defaultValue={r.linked_list_id ?? ""}
                        onChange={(e) => onChangeLink(r, e.target.value)}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus-visible:border-ring"
                      >
                        <option value="">Not linked</option>
                        {lists.map((l) => <option key={l.id} value={l.id}>{l.title} ({l.owner_name})</option>)}
                      </select>
                    </label>
                    {linkedList && (
                      <Link href={`/lists/${r.linked_list_id}`} className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> View list
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground">Budget</span>
                    <input
                      defaultValue={r.budget ?? ""}
                      onBlur={(e) => {
                        const b = num(e.target.value);
                        setRecips((prev) => prev.map((x) => (x.id === r.id ? { ...x, budget: b } : x)));
                        updateRecipient(r.id, { budget: b });
                      }}
                      placeholder="$"
                      className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm outline-none focus-visible:border-ring"
                    />
                  </label>
                  <div className="text-right">
                    <span className="block text-[11px] font-medium text-muted-foreground">Spent</span>
                    <span className={`text-sm font-semibold ${over ? "text-brand-strong" : "text-foreground"}`}>{money(spent)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${r.name} from ${year}?`)) {
                        setRecips((prev) => prev.filter((x) => x.id !== r.id));
                        deleteRecipient(r.id);
                      }
                    }}
                    aria-label={`Remove ${r.name}`}
                    className="text-muted-foreground transition-colors hover:text-brand-strong"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Gifts */}
              <div className="mt-4 space-y-2">
                {claimed.map((cg) => {
                  const pur = claimPurchase(r.id, cg.claim_id);
                  return (
                    <GiftRow
                      key={cg.claim_id}
                      label={cg.label}
                      badge={cg.ww_status === "purchased" ? "Bought on Wishing Well" : "Claimed on Wishing Well"}
                      amount={pur?.amount ?? null}
                      status={pur?.status ?? (cg.ww_status === "purchased" ? "purchased" : "idea")}
                      onAmount={async (amt) => {
                        const res = await upsertClaimGift(r.id, cg.claim_id, { amount: amt, name: cg.label });
                        if (res?.id) upsertPmap(r.id, { id: res.id, user_id: r.user_id, recipient_id: r.id, claim_id: cg.claim_id, name: cg.label, amount: amt, status: pur?.status ?? "purchased", position: 0, created_at: pur?.created_at ?? new Date().toISOString() });
                      }}
                      onStatus={async (st) => {
                        const res = await upsertClaimGift(r.id, cg.claim_id, { status: st, name: cg.label });
                        if (res?.id) upsertPmap(r.id, { id: res.id, user_id: r.user_id, recipient_id: r.id, claim_id: cg.claim_id, name: cg.label, amount: pur?.amount ?? null, status: st, position: 0, created_at: pur?.created_at ?? new Date().toISOString() });
                      }}
                    />
                  );
                })}
                {manual.map((g) => (
                  <GiftRow
                    key={g.id}
                    label={g.name ?? "Gift"}
                    editableName
                    amount={g.amount}
                    status={g.status}
                    onName={(name) => { upsertPmap(r.id, { ...g, name }); updateGift(g.id, { name }); }}
                    onAmount={(amt) => { upsertPmap(r.id, { ...g, amount: amt }); updateGift(g.id, { amount: amt }); }}
                    onStatus={(st) => { upsertPmap(r.id, { ...g, status: st }); updateGift(g.id, { status: st }); }}
                    onDelete={() => { removePmap(r.id, g.id); deleteGift(g.id); }}
                  />
                ))}
                <AddGift onAdd={async (name) => {
                  const res = await addManualGift(r.id, name);
                  if (res?.gift) upsertPmap(r.id, res.gift as GiftPurchase);
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "brand" | "accent" | "danger" }) {
  const color =
    tone === "brand" ? "text-brand-strong" : tone === "accent" ? "text-accent" : tone === "danger" ? "text-brand-strong" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function GiftRow({
  label,
  badge,
  editableName,
  amount,
  status,
  onName,
  onAmount,
  onStatus,
  onDelete,
}: {
  label: string;
  badge?: string;
  editableName?: boolean;
  amount: number | null;
  status: GiftStatus;
  onName?: (v: string) => void;
  onAmount: (v: number | null) => void;
  onStatus: (v: GiftStatus) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2.5">
      <div className="min-w-0 flex-1">
        {editableName ? (
          <input
            defaultValue={label}
            onBlur={(e) => onName?.(e.target.value)}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none hover:border-border focus:border-ring focus:bg-card"
          />
        ) : (
          <span className="block truncate px-1 text-sm font-medium text-foreground">{label}</span>
        )}
        {badge && <span className="ml-1 text-[11px] font-medium text-accent">{badge}</span>}
      </div>
      <input
        defaultValue={amount ?? ""}
        onBlur={(e) => {
          const n = e.target.value.trim() === "" ? null : parseFloat(e.target.value.replace(/[^0-9.-]/g, ""));
          onAmount(Number.isFinite(n as number) ? (n as number) : null);
        }}
        placeholder="$"
        className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-right text-sm outline-none focus-visible:border-ring"
      />
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as GiftStatus)}
        className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:border-ring"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{GIFT_STATUS_LABELS[s]}</option>)}
      </select>
      {onDelete ? (
        <button type="button" onClick={onDelete} aria-label="Remove gift" className="text-muted-foreground transition-colors hover:text-brand-strong">
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-4" />
      )}
    </div>
  );
}

function AddGift({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n) { onAdd(n); setName(""); } }}
      className="flex items-center gap-2 pt-1"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a gift (anything, on or off Wishing Well)…"
        className="h-9 flex-1 rounded-lg border border-dashed border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
      />
      <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted">
        <Plus className="h-4 w-4" /> Gift
      </button>
    </form>
  );
}
