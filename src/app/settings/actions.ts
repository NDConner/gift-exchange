"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setDisplayName(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "Your name can't be empty." };
  const { error } = await supabase.from("profiles").update({ display_name: clean }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, name: clean };
}

export async function addContact(email: string, name?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address." };
  const { data: prof } = await supabase.from("profiles").select("id,display_name").eq("email", clean).maybeSingle();
  const { data, error } = await supabase
    .from("contacts")
    .upsert(
      { user_id: user.id, email: clean, contact_user_id: prof?.id ?? null, display_name: name?.trim() || prof?.display_name || null },
      { onConflict: "user_id,email" },
    )
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true, contact: data };
}

export async function removeContact(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setDefaultAnonymous(value: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .update({ default_anonymous: value })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true };
}
