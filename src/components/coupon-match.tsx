"use client";

import { useState } from "react";
import { ChevronDown, Ticket } from "lucide-react";
import { CodeDisplay } from "./code-display";
import { WALLET_KIND_LABELS, type WalletItem } from "@/lib/types";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function valuePhrase(i: WalletItem): string {
  if (i.value_initial == null) return WALLET_KIND_LABELS[i.kind].toLowerCase();
  if (i.discount_type === "percent") return `${i.value_initial}% off`;
  const remaining = Number(i.value_remaining ?? i.value_initial);
  return money(remaining);
}

// Shown on a list item the viewer holds a code for. Reads only the viewer's own
// wallet (passed from the server), so list owners never learn anything.
export function CouponMatch({ matches }: { matches: WalletItem[] }) {
  const [open, setOpen] = useState(false);
  if (matches.length === 0) return null;

  const brand = matches[0].brand || matches[0].brand_domain || "this brand";
  const label =
    matches.length === 1
      ? `You have a ${valuePhrase(matches[0])} ${brand} ${WALLET_KIND_LABELS[matches[0].kind].toLowerCase()}`
      : `You have ${matches.length} ${brand} codes`;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-brand/40 bg-brand/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-brand-strong transition-colors hover:bg-brand/10"
      >
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand/15" aria-hidden>
          💳
        </span>
        <span className="min-w-0 flex-1">
          {label} <span className="font-normal text-muted-foreground">— tap to use</span>
        </span>
        <ChevronDown className={`h-4 w-4 flex-none transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-brand/20 bg-card px-3 py-4">
          {matches.map((m) => (
            <div key={m.id}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Ticket className="h-3.5 w-3.5 text-brand-strong" />
                {m.brand || brand} · {valuePhrase(m)}
                {m.expires_at
                  ? ` · expires ${new Date(m.expires_at.length <= 10 ? m.expires_at + "T00:00:00" : m.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : ""}
              </p>
              <CodeDisplay item={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
