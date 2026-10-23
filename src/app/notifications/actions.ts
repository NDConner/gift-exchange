"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

// RLS restricts every update to the caller's own notifications, so filtering by
// id alone is safe — a foreign id simply matches no rows.
export async function markNotificationRead(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveNotification(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .is("archived_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}
