"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GiftStatus } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

// ---- Recipients ----------------------------------------------------------
export async function addRecipient(input: {
  year: number;
  name: string;
  group_label?: string | null;
  linked_list_id?: string | null;
  budget?: number | null;
}) {
  const { supabase, user } = await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "Give the person a name." };
  const { data: last } = await supabase
    .from("gift_recipients")
    .select("position")
    .eq("user_id", user.id)
    .eq("year", input.year)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("gift_recipients")
    .insert({
      user_id: user.id,
      year: input.year,
      name,
      group_label: input.group_label?.trim() || null,
      linked_list_id: input.linked_list_id || null,
      budget: input.budget ?? null,
      position: (last?.position ?? 0) + 1,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true, recipient: data };
}

export async function updateRecipient(
  id: string,
  patch: { name?: string; group_label?: string | null; linked_list_id?: string | null; budget?: number | null },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim() || "Someone";
  if (patch.group_label !== undefined) update.group_label = patch.group_label?.trim() || null;
  if (patch.linked_list_id !== undefined) update.linked_list_id = patch.linked_list_id || null;
  if (patch.budget !== undefined) update.budget = patch.budget;
  const { error } = await supabase.from("gift_recipients").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true };
}

export async function deleteRecipient(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("gift_recipients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true };
}

// ---- Gifts ---------------------------------------------------------------
export async function addManualGift(recipientId: string, name: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("gift_purchases")
    .insert({ user_id: user.id, recipient_id: recipientId, name: name.trim() || "Gift" })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true, gift: data };
}

export async function updateGift(
  id: string,
  patch: { name?: string | null; amount?: number | null; status?: GiftStatus },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name?.trim() || null;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.status !== undefined) update.status = patch.status;
  const { error } = await supabase.from("gift_purchases").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true };
}

export async function deleteGift(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("gift_purchases").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true };
}

// Create-or-update the purchase row that annotates a Wishing Well claim with a
// price + status, so auto-shown claimed gifts can carry a budget figure.
export async function upsertClaimGift(
  recipientId: string,
  claimId: string,
  patch: { amount?: number | null; status?: GiftStatus; name?: string | null },
) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("gift_purchases")
    .select("id")
    .eq("recipient_id", recipientId)
    .eq("claim_id", claimId)
    .maybeSingle();
  if (existing) {
    const update: Record<string, unknown> = {};
    if (patch.amount !== undefined) update.amount = patch.amount;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.name !== undefined) update.name = patch.name;
    const { error } = await supabase.from("gift_purchases").update(update).eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/gift-giving");
    return { ok: true, id: existing.id };
  }
  const { data, error } = await supabase
    .from("gift_purchases")
    .insert({
      user_id: user.id,
      recipient_id: recipientId,
      claim_id: claimId,
      name: patch.name ?? null,
      amount: patch.amount ?? null,
      status: patch.status ?? "purchased",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/gift-giving");
  return { ok: true, id: data.id };
}
