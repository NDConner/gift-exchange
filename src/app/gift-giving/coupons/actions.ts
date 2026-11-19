"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { itemDomains, normalizeDomain } from "@/lib/coupon-match";
import { WALLET_KIND_LABELS, type WalletItem, type WalletKind } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export type WalletInput = {
  kind: WalletKind;
  brand?: string | null;
  brand_domain?: string | null;
  brand_logo_url?: string | null;
  code?: string | null;
  pin?: string | null;
  barcode_value?: string | null;
  barcode_format?: string | null;
  value_initial?: number | null;
  discount_type?: "amount" | "percent" | null;
  notes?: string | null;
  image_path?: string | null;
  expires_at?: string | null;
};

export async function addWalletItem(input: WalletInput) {
  const { supabase, user } = await requireUser();
  const brand_domain = normalizeDomain(input.brand_domain || input.brand || null);
  const row = {
    user_id: user.id,
    kind: input.kind,
    brand: input.brand?.trim() || null,
    brand_domain,
    brand_logo_url: input.brand_logo_url || null,
    code: input.code?.trim() || null,
    pin: input.pin?.trim() || null,
    barcode_value: input.barcode_value?.trim() || input.code?.trim() || null,
    barcode_format: input.barcode_format || null,
    value_initial: input.value_initial ?? null,
    value_remaining: input.value_initial ?? null,
    discount_type: input.discount_type ?? null,
    notes: input.notes?.trim() || null,
    image_path: input.image_path || null,
    expires_at: input.expires_at || null,
    status: "active" as const,
  };
  const { data, error } = await supabase.from("wallet_items").insert(row).select("*").single();
  if (error) return { error: error.message };
  // Fire-and-forget: flag any shared lists that have an item for this brand.
  if (brand_domain) await notifyCouponMatches(user.id, data as WalletItem);
  revalidatePath("/gift-giving/coupons");
  return { ok: true, item: data };
}

export async function updateWalletItem(id: string, patch: Partial<WalletInput> & { status?: WalletItem["status"]; value_remaining?: number | null }) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  for (const k of ["kind", "brand", "code", "pin", "barcode_value", "barcode_format", "value_initial", "value_remaining", "discount_type", "notes", "expires_at", "status"] as const) {
    if (patch[k as keyof typeof patch] !== undefined) update[k] = patch[k as keyof typeof patch];
  }
  if (patch.brand_domain !== undefined || patch.brand !== undefined) {
    update.brand_domain = normalizeDomain(patch.brand_domain || patch.brand || null);
  }
  const { error } = await supabase.from("wallet_items").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving/coupons");
  return { ok: true };
}

export async function deleteWalletItem(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("wallet_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving/coupons");
  return { ok: true };
}

// Mark used: log a redemption and decrement the remaining value.
export async function redeemWalletItem(id: string, opts: { amount?: number | null; markUsed?: boolean; note?: string | null }) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("wallet_items").select("*").eq("id", id).single();
  if (!item) return { error: "Not found." };

  await supabase.from("wallet_redemptions").insert({
    user_id: user.id,
    wallet_item_id: id,
    amount: opts.amount ?? null,
    note: opts.note?.trim() || null,
  });

  const base = (item.value_remaining ?? item.value_initial ?? 0) as number;
  const newRemaining = opts.amount != null ? Math.max(0, base - opts.amount) : item.value_remaining;
  const used = opts.markUsed || (newRemaining != null && newRemaining <= 0 && (item.value_initial ?? 0) > 0);
  const { error } = await supabase
    .from("wallet_items")
    .update({ value_remaining: newRemaining, status: used ? "used" : item.status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving/coupons");
  return { ok: true, value_remaining: newRemaining, status: used ? "used" : item.status };
}

// Create a one-time coupon_match notification for each shared list that has an
// item for this brand. Uses the admin client because notifications are
// trigger/service-written (no user insert policy) — we only ever notify the
// item's own owner about their own wallet.
async function notifyCouponMatches(userId: string, wallet: WalletItem) {
  try {
    if (!wallet.brand_domain) return;
    const supabase = await createClient(); // RLS → only lists the user can access
    const { data: lists } = await supabase.from("lists").select("id,title,owner_id").neq("owner_id", userId);
    if (!lists?.length) return;
    const listIds = lists.map((l) => l.id);
    const { data: items } = await supabase
      .from("list_items")
      .select("list_id,url,links,options:list_item_options(url)")
      .in("list_id", listIds)
      .is("deleted_at", null);
    const matched = new Set<string>();
    const domain = wallet.brand_domain.toLowerCase();
    for (const it of items ?? []) if (itemDomains(it).includes(domain)) matched.add(it.list_id);
    if (!matched.size) return;
    const admin = createAdminClient();
    const brand = wallet.brand || wallet.brand_domain;
    const kindLabel = WALLET_KIND_LABELS[wallet.kind].toLowerCase();
    const rows = [...matched].map((lid) => ({
      user_id: userId,
      type: "coupon_match",
      list_id: lid,
      title: brand,
      body: `You have a ${brand} ${kindLabel} that matches an item on “${lists.find((l) => l.id === lid)?.title ?? "a list"}”. Use it!`,
    }));
    await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort — never block adding a wallet item */
  }
}
