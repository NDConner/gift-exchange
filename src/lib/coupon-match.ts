import type { WalletItem } from "@/lib/types";

// Extract a clean host from a URL-ish string ("quince.com", "https://www.quince.com/x").
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Domains a list item references: its single url, each of its links, and each
// buy-option's url (options are where brand/vendor links usually live).
export function itemDomains(item: {
  url?: string | null;
  links?: { url: string }[] | null;
  options?: { url: string | null }[] | null;
}): string[] {
  const out = new Set<string>();
  const add = (u?: string | null) => {
    const d = normalizeDomain(u);
    if (d) out.add(d);
  };
  add(item.url);
  for (const l of item.links ?? []) add(l.url);
  for (const o of item.options ?? []) add(o.url);
  return [...out];
}

// Wallet items (active, not expired) whose brand_domain matches any of the item's domains.
export function matchWalletToItem(
  item: { url?: string | null; links?: { url: string }[] | null; options?: { url: string | null }[] | null },
  wallet: WalletItem[],
  todayIso: string,
): WalletItem[] {
  const domains = itemDomains(item);
  if (domains.length === 0) return [];
  return wallet.filter(
    (w) =>
      w.status === "active" &&
      (!w.expires_at || w.expires_at >= todayIso) &&
      !!w.brand_domain &&
      domains.includes(w.brand_domain.toLowerCase()),
  );
}
