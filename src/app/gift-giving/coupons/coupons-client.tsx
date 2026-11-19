"use client";

import { useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, Plus, Sparkles, Ticket, Trash2, X } from "lucide-react";
import { CodeDisplay } from "@/components/code-display";
import { uploadScan } from "@/lib/upload-scan";
import { WALLET_KIND_LABELS, type WalletItem, type WalletKind } from "@/lib/types";
import { addWalletItem, deleteWalletItem, redeemWalletItem, type WalletInput } from "./actions";

const KINDS: WalletKind[] = ["coupon", "gift_card", "store_credit", "loyalty", "other"];
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const parseNum = (v: string): number | null => {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
// Parse a date-only string (YYYY-MM-DD) as LOCAL midnight so it never shifts a day.
const asLocalDate = (iso: string) => new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
const fmtDate = (iso: string) => asLocalDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const daysUntil = (iso: string | null) => (iso ? Math.ceil((asLocalDate(iso).getTime() - Date.now()) / 86400000) : null);
const valueLabel = (i: WalletItem) =>
  i.value_initial == null
    ? "—"
    : i.discount_type === "percent"
      ? `${i.value_initial}% off`
      : money(Number(i.value_initial));

export function Coupons({
  initial,
  usedByItem,
  aiConfigured,
}: {
  initial: WalletItem[];
  usedByItem: Record<string, number>;
  aiConfigured: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [used, setUsed] = useState(usedByItem);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const held = items
    .filter((i) => i.status === "active" && (i.kind === "gift_card" || i.kind === "store_credit"))
    .reduce((s, i) => s + Number(i.value_remaining ?? i.value_initial ?? 0), 0);
  const usedTotal = Object.values(used).reduce((s, n) => s + n, 0);
  const expiringSoon = items.filter((i) => i.status === "active" && (daysUntil(i.expires_at) ?? 999) <= 30 && (daysUntil(i.expires_at) ?? -1) >= 0).length;

  // A percent coupon has no dollar balance, so it has no monetary "outstanding".
  const outstanding = (i: WalletItem) =>
    i.value_initial == null || i.discount_type === "percent" ? null : Number(i.value_remaining ?? i.value_initial ?? 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            <Ticket className="h-7 w-7 text-brand" /> Coupon Overview
          </h1>
          <p className="mt-1 text-muted-foreground">Every coupon, code, gift card, and credit — scanned, stored, ready to use.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong"
        >
          <Plus className="h-4 w-4" /> Add a code
        </button>
      </div>

      {/* Analytics */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Tile label="Credit on hand" value={money(held)} tone="brand" />
        <Tile label="Used so far" value={money(usedTotal)} tone="accent" />
        <Tile label="Expiring ≤30d" value={String(expiringSoon)} tone={expiringSoon ? "danger" : "muted"} />
        <Tile label="Codes stored" value={String(items.length)} />
      </div>

      {adding && (
        <AddCoupon
          aiConfigured={aiConfigured}
          onClose={() => setAdding(false)}
          onAdded={(it) => {
            setItems((prev) => [it, ...prev]);
            setAdding(false);
            setOpenId(it.id);
          }}
        />
      )}

      {/* Overview table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Initial</th>
              <th className="px-4 py-3 text-right font-medium">Used</th>
              <th className="px-4 py-3 text-right font-medium">Outstanding</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No codes yet — tap <span className="font-medium text-foreground">Add a code</span> to scan or snap your first one.
                </td>
              </tr>
            )}
            {items.map((i) => {
              const d = daysUntil(i.expires_at);
              const out = outstanding(i);
              return (
                <RowGroup key={i.id} open={openId === i.id}>
                  <tr className={`border-b border-border/60 ${i.status !== "active" ? "opacity-55" : ""}`}>
                    <td className="px-4 py-3 font-medium text-foreground">{i.brand || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{WALLET_KIND_LABELS[i.kind]}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{valueLabel(i)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{used[i.id] ? money(used[i.id]) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {i.status === "used" ? "Used" : out == null ? "—" : money(out)}
                    </td>
                    <td className="px-4 py-3">
                      {i.expires_at ? (
                        <span className={d != null && d <= 30 && d >= 0 ? "font-medium text-brand-strong" : "text-muted-foreground"}>
                          {fmtDate(i.expires_at)}
                          {d != null && d >= 0 && d <= 30 ? ` · ${d}d` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === i.id ? null : i.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        Use <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openId === i.id ? "rotate-180" : ""}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove this ${WALLET_KIND_LABELS[i.kind].toLowerCase()}?`)) {
                            setItems((prev) => prev.filter((x) => x.id !== i.id));
                            deleteWalletItem(i.id);
                          }
                        }}
                        aria-label="Remove"
                        className="text-muted-foreground transition-colors hover:text-brand-strong"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {openId === i.id && (
                    <tr className="border-b border-border/60 bg-background/40">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <CodeDisplay item={i} />
                          <RedeemPanel
                            item={i}
                            onRedeem={(remaining, status, amt) => {
                              setItems((prev) => prev.map((x) => (x.id === i.id ? { ...x, value_remaining: remaining, status } : x)));
                              if (amt) setUsed((prev) => ({ ...prev, [i.id]: (prev[i.id] ?? 0) + amt }));
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode; open: boolean }) {
  return <>{children}</>;
}

function Tile({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "brand" | "accent" | "danger" }) {
  const color = tone === "brand" ? "text-brand-strong" : tone === "accent" ? "text-accent" : tone === "danger" ? "text-brand-strong" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function RedeemPanel({ item, onRedeem }: { item: WalletItem; onRedeem: (remaining: number | null, status: WalletItem["status"], amount?: number) => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(markUsed: boolean) {
    setBusy(true);
    const amt = markUsed ? null : parseNum(amount);
    const r = await redeemWalletItem(item.id, { amount: amt, markUsed });
    if (r?.ok) {
      onRedeem(r.value_remaining ?? null, r.status as WalletItem["status"], amt ?? undefined);
      setAmount("");
    }
    setBusy(false);
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-sm font-semibold text-foreground">Mark used</h4>
      <p className="mt-1 text-xs text-muted-foreground">Log what you spent so your balance stays right.</p>
      {(item.kind === "gift_card" || item.kind === "store_credit") && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$ amount used"
            className="h-9 w-32 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
          />
          <button type="button" onClick={() => run(false)} disabled={busy || !parseNum(amount)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Deduct
          </button>
        </div>
      )}
      <button type="button" onClick={() => run(true)} disabled={busy}
        className="mt-3 inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">
        Mark fully used
      </button>
      {item.notes && <p className="mt-3 text-xs text-muted-foreground">{item.notes}</p>}
    </div>
  );
}

function AddCoupon({ aiConfigured, onAdded, onClose }: { aiConfigured: boolean; onAdded: (it: WalletItem) => void; onClose: () => void }) {
  const [form, setForm] = useState<WalletInput>({ kind: "coupon" });
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "scan" | "save">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<WalletInput>) => setForm((f) => ({ ...f, ...patch }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("scan");
    setMsg(null);
    // 1) store the photo privately
    const up = await uploadScan(file);
    if (up.path) setImagePath(up.path);
    // 2) decode a barcode/QR from the photo (no AI needed)
    try {
      const url = URL.createObjectURL(file);
      const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      const res = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      const fmtMap: Record<number, string> = {
        [BarcodeFormat.QR_CODE]: "qr",
        [BarcodeFormat.CODE_128]: "code128",
        [BarcodeFormat.UPC_A]: "upc",
        [BarcodeFormat.UPC_E]: "upc",
        [BarcodeFormat.EAN_13]: "ean",
      };
      set({ barcode_value: res.getText(), code: form.code || res.getText(), barcode_format: fmtMap[res.getBarcodeFormat()] ?? null });
    } catch {
      /* no barcode in the photo — fine */
    }
    // 3) AI field extraction
    if (aiConfigured) {
      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file);
        });
        const [, b64] = dataUrl.split(",");
        const mediaType = dataUrl.slice(5, dataUrl.indexOf(";"));
        const resp = await fetch("/api/extract-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64: b64, mediaType }),
        });
        const json = await resp.json();
        if (json?.extracted) {
          const x = json.extracted;
          set({
            kind: KINDS.includes(x.kind) ? x.kind : form.kind,
            brand: x.brand ?? form.brand,
            brand_domain: x.brand_domain ?? form.brand_domain,
            code: x.code ?? form.code,
            pin: x.pin ?? form.pin,
            value_initial: typeof x.value_initial === "number" ? x.value_initial : form.value_initial,
            discount_type: x.discount_type ?? form.discount_type,
            expires_at: x.expires_at ?? form.expires_at,
            barcode_format: x.barcode_format ?? form.barcode_format,
          });
          setMsg("Read from your photo — check the details below.");
        } else if (json?.error === "ai_not_configured") {
          setMsg("Barcode captured. (Add an Anthropic key to auto-read the rest from the photo.)");
        }
      } catch {
        setMsg("Barcode captured — fill in the rest below.");
      }
    } else {
      setMsg("Barcode captured. Fill in brand/value/expiry below.");
    }
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    const r = await addWalletItem({ ...form, image_path: imagePath });
    setBusy(null);
    if (r?.error) setMsg(r.error);
    else if (r?.item) onAdded(r.item as WalletItem);
  }

  const inputCls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring";

  return (
    <div className="mt-5 rounded-2xl border border-brand/40 bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Add a code</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy === "scan"}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        Scan / take a photo
        {aiConfigured && <span className="inline-flex items-center gap-1 text-xs text-accent"><Sparkles className="h-3 w-3" /> auto-fill</span>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select value={form.kind} onChange={(e) => set({ kind: e.target.value as WalletKind })} className={inputCls}>
            {KINDS.map((k) => <option key={k} value={k}>{WALLET_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <input value={form.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} placeholder="e.g. Quince" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Website (for matching)</span>
          <input value={form.brand_domain ?? ""} onChange={(e) => set({ brand_domain: e.target.value })} placeholder="quince.com" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Code</span>
          <input value={form.code ?? ""} onChange={(e) => set({ code: e.target.value })} placeholder="Code / card number" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">PIN (gift cards)</span>
          <input value={form.pin ?? ""} onChange={(e) => set({ pin: e.target.value })} placeholder="Optional" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Value</span>
          <div className="flex items-center gap-2">
            <input value={form.value_initial ?? ""} onChange={(e) => set({ value_initial: parseNum(e.target.value) })} placeholder="50" className={inputCls} />
            <select value={form.discount_type ?? "amount"} onChange={(e) => set({ discount_type: e.target.value as "amount" | "percent" })} className="h-10 flex-none rounded-lg border border-border bg-background px-2 text-sm">
              <option value="amount">$</option>
              <option value="percent">%</option>
            </select>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Expires</span>
          <input type="date" value={form.expires_at ?? ""} onChange={(e) => set({ expires_at: e.target.value || null })} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <input value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. min spend $75, in-store only" className={inputCls} />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={save} disabled={busy === "save"}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save code
        </button>
      </div>
    </div>
  );
}
