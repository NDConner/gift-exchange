"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Gift, Plus, Search, Trash2, X } from "lucide-react";
import {
  GIFT_STATUS_LABELS,
  type GiftKind,
  type GiftPurchase,
  type GiftRecipient,
  type GiftStatus,
  type RecipientStatus,
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
const UNGROUPED = "Ungrouped";
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = parseFloat(t.replace(/[^0-9.-]/g, ""));
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
  const [view, setView] = useState<"detailed" | "executive">("detailed");
  const [groupFilter, setGroupFilter] = useState<string>(""); // "" = all
  const [peopleFilter, setPeopleFilter] = useState<Set<string>>(new Set());
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState(String(Math.max(...years) + 1));
  const [pName, setPName] = useState("");
  const [pGroup, setPGroup] = useState("");
  const [pList, setPList] = useState("");
  const [pBudget, setPBudget] = useState("");

  const giftsOf = (rid: string) => pmap[rid] ?? [];
  const spentOf = (rid: string) => giftsOf(rid).reduce((s, p) => s + (p.amount ?? 0), 0);
  const claimPurchase = (rid: string, claimId: string) => giftsOf(rid).find((p) => p.claim_id === claimId);
  const manualGifts = (rid: string) => giftsOf(rid).filter((p) => !p.claim_id);
  const groupOf = (r: GiftRecipient) => r.group_label?.trim() || UNGROUPED;

  const totalBudget = recips.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = recips.reduce((s, r) => s + spentOf(r.id), 0);
  const remaining = totalBudget - totalSpent;
  const giftCount = recips.reduce((s, r) => s + giftsOf(r.id).length, 0);
  const purchasedCount = recips.reduce((s, r) => s + giftsOf(r.id).filter((p) => p.status !== "idea").length, 0);

  const groups = useMemo(() => [...new Set(recips.map(groupOf))].sort(), [recips]);

  // People currently selectable in the filter (respecting the group filter).
  const groupScoped = groupFilter ? recips.filter((r) => groupOf(r) === groupFilter) : recips;
  const visibleRecips = groupScoped.filter((r) => peopleFilter.size === 0 || peopleFilter.has(r.id));

  function upsertPmap(rid: string, row: GiftPurchase) {
    setPmap((prev) => {
      const arr = (prev[rid] ?? []).slice();
      const i = arr.findIndex((p) => p.id === row.id);
      if (i === -1) arr.push(row);
      else arr[i] = row;
      return { ...prev, [rid]: arr };
    });
  }
  const removePmap = (rid: string, id: string) =>
    setPmap((prev) => ({ ...prev, [rid]: (prev[rid] ?? []).filter((p) => p.id !== id) }));
  const patchRecip = (id: string, patch: Partial<GiftRecipient>) =>
    setRecips((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const goYear = (y: number) => router.push(`/gift-giving?year=${y}`);

  async function onAddPerson(e: React.FormEvent) {
    e.preventDefault();
    const name = pName.trim();
    if (!name) return;
    const r = await addRecipient({ year, name, group_label: pGroup || null, linked_list_id: pList || null, budget: num(pBudget) });
    if (r?.recipient) {
      setRecips((prev) => [...prev, r.recipient as GiftRecipient]);
      setPName(""); setPGroup(""); setPList(""); setPBudget("");
      if (pList) router.refresh();
    }
  }
  async function onChangeLink(r: GiftRecipient, listId: string) {
    patchRecip(r.id, { linked_list_id: listId || null });
    await updateRecipient(r.id, { linked_list_id: listId || null });
    router.refresh();
  }
  function togglePerson(id: string) {
    setPeopleFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tabBtn = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? "bg-brand text-brand-foreground" : "border border-border bg-card hover:bg-muted"}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <Gift className="h-7 w-7 text-brand" /> Gift Giving
          </h1>
          <p className="mt-1 text-muted-foreground">Track who you&rsquo;re buying for, your budget, and what you&rsquo;ve spent.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {years.map((y) => (
            <button key={y} type="button" onClick={() => goYear(y)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${y === year ? "bg-brand text-brand-foreground" : "border border-border bg-card hover:bg-muted"}`}>
              {y}
            </button>
          ))}
          {addingYear ? (
            <span className="inline-flex items-center gap-1">
              <input value={newYear} onChange={(e) => setNewYear(e.target.value)}
                className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring" />
              <button type="button" onClick={() => num(newYear) && goYear(Math.trunc(num(newYear)!))}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground hover:bg-brand-strong">Go</button>
            </span>
          ) : (
            <button type="button" onClick={() => setAddingYear(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Year
            </button>
          )}
        </div>
      </div>

      {/* View switcher */}
      <div className="mt-5 flex items-center gap-1.5">
        <button type="button" className={tabBtn(view === "detailed")} onClick={() => setView("detailed")}>Detailed</button>
        <button type="button" className={tabBtn(view === "executive")} onClick={() => setView("executive")}>Executive</button>
      </div>

      {/* Analytics */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="Budget" value={money(totalBudget)} />
        <StatTile label="Spent" value={money(totalSpent)} tone="brand" />
        <StatTile label={remaining >= 0 ? "Left to spend" : "Over budget"} value={money(Math.abs(remaining))} tone={remaining >= 0 ? "accent" : "danger"} />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {recips.length} {recips.length === 1 ? "person" : "people"} · {purchasedCount}/{giftCount} gifts bought ·{" "}
            {recips.filter((r) => r.status === "complete").length}/{recips.length} people done
          </span>
          <span className="text-muted-foreground">{totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget` : "No budget set"}</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${remaining >= 0 ? "bg-brand" : "bg-brand-strong"}`}
            style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }} />
        </div>
        <SpendBars recips={recips} spentOf={spentOf} />
      </div>

      {view === "executive" ? (
        <ExecutiveView recips={recips} groupOf={groupOf} spentOf={spentOf} giftsOf={giftsOf} />
      ) : (
        <>
          {/* Add person */}
          <form onSubmit={onAddPerson} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Who are you buying for?</span>
              <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Nick Conner"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
            </label>
            <label className="flex w-32 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Group</span>
              <input value={pGroup} onChange={(e) => setPGroup(e.target.value)} placeholder="Family" list="gg-groups"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
              <datalist id="gg-groups">{groups.filter((g) => g !== UNGROUPED).map((g) => <option key={g} value={g} />)}</datalist>
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

          {/* Filter */}
          {recips.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Filter:</span>
              <button type="button" onClick={() => { setGroupFilter(""); setPeopleFilter(new Set()); }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${!groupFilter && peopleFilter.size === 0 ? "bg-brand text-brand-foreground" : "border border-border hover:bg-muted"}`}>
                All
              </button>
              {groups.map((g) => (
                <button key={g} type="button" onClick={() => { setGroupFilter(g === groupFilter ? "" : g); setPeopleFilter(new Set()); }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${g === groupFilter ? "bg-brand text-brand-foreground" : "border border-border hover:bg-muted"}`}>
                  {g}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">People:</span>
              {groupScoped.map((r) => (
                <button key={r.id} type="button" onClick={() => togglePerson(r.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${peopleFilter.has(r.id) ? "bg-accent/20 text-accent" : "border border-border hover:bg-muted"}`}>
                  {r.name}
                </button>
              ))}
              {peopleFilter.size > 0 && (
                <button type="button" onClick={() => setPeopleFilter(new Set())} className="text-xs text-muted-foreground underline">clear</button>
              )}
            </div>
          )}

          {/* Recipients */}
          <div className="mt-4 space-y-4">
            {recips.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
                <Gift className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 font-medium text-foreground">No one added for {year} yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add the people you&rsquo;re buying for above.</p>
              </div>
            )}
            {visibleRecips.map((r) => {
              const claimed = r.linked_list_id ? claimedGiftsByList[r.linked_list_id] ?? [] : [];
              const manual = manualGifts(r.id);
              const spent = spentOf(r.id);
              const over = (r.budget ?? 0) > 0 && spent > (r.budget ?? 0);
              const linkedList = lists.find((l) => l.id === r.linked_list_id);
              return (
                <div key={r.id} className={`rounded-2xl border bg-card p-5 ${r.status === "complete" ? "border-accent/40" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-card-foreground">{r.name}</h3>
                        {r.group_label && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{r.group_label}</span>}
                        {r.status === "complete" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>
                        )}
                        {r.clue_hunt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-strong"><Search className="h-3.5 w-3.5" /> Clue hunt</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <select value={r.status} onChange={(e) => { const s = e.target.value as RecipientStatus; patchRecip(r.id, { status: s }); updateRecipient(r.id, { status: s }); }}
                          className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus-visible:border-ring">
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                        </select>
                        <button type="button" onClick={() => { patchRecip(r.id, { clue_hunt: !r.clue_hunt }); updateRecipient(r.id, { clue_hunt: !r.clue_hunt }); }}
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors ${r.clue_hunt ? "border-brand/40 bg-brand/10 text-brand-strong" : "border-border text-muted-foreground hover:bg-muted"}`}>
                          <Search className="h-3.5 w-3.5" /> Clue hunt
                        </button>
                        <label className="flex items-center gap-1 text-muted-foreground">
                          List:
                          <select defaultValue={r.linked_list_id ?? ""} onChange={(e) => onChangeLink(r, e.target.value)}
                            className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus-visible:border-ring">
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
                        <input defaultValue={r.budget ?? ""} onBlur={(e) => { const b = num(e.target.value); patchRecip(r.id, { budget: b }); updateRecipient(r.id, { budget: b }); }}
                          placeholder="$" className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm outline-none focus-visible:border-ring" />
                      </label>
                      <div className="text-right">
                        <span className="block text-[11px] font-medium text-muted-foreground">Spent</span>
                        <span className={`text-sm font-semibold ${over ? "text-brand-strong" : "text-foreground"}`}>{money(spent)}</span>
                      </div>
                      <button type="button" onClick={() => { if (confirm(`Remove ${r.name} from ${year}?`)) { setRecips((prev) => prev.filter((x) => x.id !== r.id)); deleteRecipient(r.id); } }}
                        aria-label={`Remove ${r.name}`} className="text-muted-foreground transition-colors hover:text-brand-strong">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {claimed.map((cg) => {
                      const pur = claimPurchase(r.id, cg.claim_id);
                      const base = () => ({ user_id: r.user_id, recipient_id: r.id, claim_id: cg.claim_id, name: cg.label, amount: pur?.amount ?? null, status: pur?.status ?? (cg.ww_status === "purchased" ? "purchased" : "idea") as GiftStatus, kind: pur?.kind ?? "full" as GiftKind, clue_hunt: pur?.clue_hunt ?? false, position: 0, created_at: pur?.created_at ?? new Date().toISOString() });
                      return (
                        <GiftRow key={cg.claim_id} label={cg.label}
                          badge={cg.ww_status === "purchased" ? "Bought on Wishing Well" : "Claimed on Wishing Well"}
                          amount={pur?.amount ?? null} status={pur?.status ?? (cg.ww_status === "purchased" ? "purchased" : "idea")} kind={pur?.kind ?? "full"} clueHunt={pur?.clue_hunt ?? false}
                          onAmount={async (amt) => { const res = await upsertClaimGift(r.id, cg.claim_id, { amount: amt, name: cg.label }); if (res?.id) upsertPmap(r.id, { id: res.id, ...base(), amount: amt }); }}
                          onStatus={async (st) => { const res = await upsertClaimGift(r.id, cg.claim_id, { status: st, name: cg.label }); if (res?.id) upsertPmap(r.id, { id: res.id, ...base(), status: st }); }}
                          onKind={async (k) => { const res = await upsertClaimGift(r.id, cg.claim_id, { kind: k, name: cg.label }); if (res?.id) upsertPmap(r.id, { id: res.id, ...base(), kind: k }); }}
                          onClueHunt={async (c) => { const res = await upsertClaimGift(r.id, cg.claim_id, { clue_hunt: c, name: cg.label }); if (res?.id) upsertPmap(r.id, { id: res.id, ...base(), clue_hunt: c }); }}
                        />
                      );
                    })}
                    {manual.map((g) => (
                      <GiftRow key={g.id} label={g.name ?? "Gift"} editableName amount={g.amount} status={g.status} kind={g.kind} clueHunt={g.clue_hunt}
                        onName={(name) => { upsertPmap(r.id, { ...g, name }); updateGift(g.id, { name }); }}
                        onAmount={(amt) => { upsertPmap(r.id, { ...g, amount: amt }); updateGift(g.id, { amount: amt }); }}
                        onStatus={(st) => { upsertPmap(r.id, { ...g, status: st }); updateGift(g.id, { status: st }); }}
                        onKind={(k) => { upsertPmap(r.id, { ...g, kind: k }); updateGift(g.id, { kind: k }); }}
                        onClueHunt={(c) => { upsertPmap(r.id, { ...g, clue_hunt: c }); updateGift(g.id, { clue_hunt: c }); }}
                        onDelete={() => { removePmap(r.id, g.id); deleteGift(g.id); }}
                      />
                    ))}
                    <AddGift onAdd={async (name) => { const res = await addManualGift(r.id, name); if (res?.gift) upsertPmap(r.id, res.gift as GiftPurchase); }} />
                  </div>
                </div>
              );
            })}
            {recips.length > 0 && visibleRecips.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">No one matches this filter.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Per-person spend bars, scaled by absolute spend so the biggest spend is the
// longest bar (sorted highest-first), with a tick marking each person's budget.
function SpendBars({ recips, spentOf }: { recips: GiftRecipient[]; spentOf: (id: string) => number }) {
  if (recips.length === 0) return null;
  const rows = recips.map((r) => ({ r, spent: spentOf(r.id), budget: r.budget ?? 0 })).sort((a, b) => b.spent - a.spent);
  const scaleMax = Math.max(1, ...rows.map((x) => Math.max(x.spent, x.budget)));
  return (
    <div className="mt-4 space-y-2">
      {rows.map(({ r, spent, budget }) => {
        const over = budget > 0 && spent > budget;
        return (
          <div key={r.id} className="flex items-center gap-3 text-xs">
            <span className="w-28 flex-none truncate text-foreground">{r.name}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-brand-strong" : "bg-accent"}`} style={{ width: `${(spent / scaleMax) * 100}%` }} />
              {budget > 0 && (
                <span className="absolute inset-y-[-2px] w-0.5 bg-foreground/50" title={`Budget ${money(budget)}`} style={{ left: `${(budget / scaleMax) * 100}%` }} />
              )}
            </span>
            <span className="w-28 flex-none text-right text-muted-foreground">
              {money(spent)}{budget > 0 ? ` / ${money(budget)}` : ""}
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-muted-foreground">Bars scaled to spend (longest = most spent); the tick marks each budget.</p>
    </div>
  );
}

function ExecutiveView({
  recips,
  groupOf,
  spentOf,
  giftsOf,
}: {
  recips: GiftRecipient[];
  groupOf: (r: GiftRecipient) => string;
  spentOf: (id: string) => number;
  giftsOf: (id: string) => GiftPurchase[];
}) {
  const groups = [...new Set(recips.map(groupOf))].sort();
  const rows = groups.map((g) => {
    const people = recips.filter((r) => groupOf(r) === g);
    const gifts = people.flatMap((r) => giftsOf(r.id));
    return {
      g,
      people: people.length,
      complete: people.filter((r) => r.status === "complete").length,
      gifts: gifts.length,
      bought: gifts.filter((x) => x.status !== "idea").length,
      budget: people.reduce((s, r) => s + (r.budget ?? 0), 0),
      spent: people.reduce((s, r) => s + spentOf(r.id), 0),
    };
  });
  const tot = rows.reduce(
    (a, r) => ({ people: a.people + r.people, complete: a.complete + r.complete, gifts: a.gifts + r.gifts, bought: a.bought + r.bought, budget: a.budget + r.budget, spent: a.spent + r.spent }),
    { people: 0, complete: 0, gifts: 0, bought: 0, budget: 0, spent: 0 },
  );
  if (recips.length === 0) {
    return <p className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">Nothing to summarize yet — add people in the Detailed view.</p>;
  }
  const ou = (budget: number, spent: number) => {
    const d = spent - budget;
    return <span className={d > 0 ? "font-medium text-brand-strong" : "text-accent"}>{d > 0 ? `+${money(d)}` : money(Math.abs(d))}{d > 0 ? " over" : " left"}</span>;
  };
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Group</th>
            <th className="px-4 py-3 font-medium">People (done)</th>
            <th className="px-4 py-3 font-medium">Gifts (bought)</th>
            <th className="px-4 py-3 text-right font-medium">Budget</th>
            <th className="px-4 py-3 text-right font-medium">Spent</th>
            <th className="px-4 py-3 text-right font-medium">Over / Under</th>
            <th className="px-4 py-3 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.g} className="border-b border-border/60">
              <td className="px-4 py-3 font-medium text-foreground">{r.g}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.complete}/{r.people}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.bought}/{r.gifts}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{money(r.budget)}</td>
              <td className="px-4 py-3 text-right font-medium text-foreground">{money(r.spent)}</td>
              <td className="px-4 py-3 text-right">{ou(r.budget, r.spent)}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="relative h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${r.budget > 0 && r.spent > r.budget ? "bg-brand-strong" : "bg-brand"}`}
                      style={{ width: `${r.budget > 0 ? Math.min(100, (r.spent / r.budget) * 100) : r.spent > 0 ? 100 : 0}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground">{r.people > 0 ? Math.round((r.complete / r.people) * 100) : 0}% done</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 font-semibold text-foreground">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3">{tot.complete}/{tot.people}</td>
            <td className="px-4 py-3">{tot.bought}/{tot.gifts}</td>
            <td className="px-4 py-3 text-right">{money(tot.budget)}</td>
            <td className="px-4 py-3 text-right">{money(tot.spent)}</td>
            <td className="px-4 py-3 text-right">{ou(tot.budget, tot.spent)}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StatTile({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "brand" | "accent" | "danger" }) {
  const color = tone === "brand" ? "text-brand-strong" : tone === "accent" ? "text-accent" : tone === "danger" ? "text-brand-strong" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function GiftRow({
  label, badge, editableName, amount, status, kind, clueHunt, onName, onAmount, onStatus, onKind, onClueHunt, onDelete,
}: {
  label: string;
  badge?: string;
  editableName?: boolean;
  amount: number | null;
  status: GiftStatus;
  kind: GiftKind;
  clueHunt: boolean;
  onName?: (v: string) => void;
  onAmount: (v: number | null) => void;
  onStatus: (v: GiftStatus) => void;
  onKind: (v: GiftKind) => void;
  onClueHunt: (v: boolean) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2.5">
      <div className="min-w-0 flex-1">
        {editableName ? (
          <input defaultValue={label} onBlur={(e) => onName?.(e.target.value)}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none hover:border-border focus:border-ring focus:bg-card" />
        ) : (
          <span className="block truncate px-1 text-sm font-medium text-foreground">{label}</span>
        )}
        {badge && <span className="ml-1 text-[11px] font-medium text-accent">{badge}</span>}
      </div>
      <button type="button" onClick={() => onClueHunt(!clueHunt)} aria-label="Toggle clue hunt"
        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs transition-colors ${clueHunt ? "border-brand/40 bg-brand/10 text-brand-strong" : "border-border text-muted-foreground hover:bg-muted"}`}>
        <Search className="h-3.5 w-3.5" />
      </button>
      <select value={kind} onChange={(e) => onKind(e.target.value as GiftKind)}
        className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:border-ring">
        <option value="full">Full gift</option>
        <option value="stocking">Stocking</option>
      </select>
      <input defaultValue={amount ?? ""} onBlur={(e) => onAmount(num(e.target.value))} placeholder="$"
        className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-right text-sm outline-none focus-visible:border-ring" />
      <select value={status} onChange={(e) => onStatus(e.target.value as GiftStatus)}
        className="h-9 rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:border-ring">
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
    <form onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n) { onAdd(n); setName(""); } }} className="flex items-center gap-2 pt-1">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a gift (anything, on or off Wishing Well)…"
        className="h-9 flex-1 rounded-lg border border-dashed border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
      <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted">
        <Plus className="h-4 w-4" /> Gift
      </button>
    </form>
  );
}
