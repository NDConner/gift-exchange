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
