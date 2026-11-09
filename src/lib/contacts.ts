import type { SupabaseClient } from "@supabase/supabase-js";

// Remember a person you shared with / invited, so they can be picked next time.
// Best-effort: never throws (a failure here must not break a share/invite).
export async function rememberContact(supabase: SupabaseClient, userId: string, rawEmail: string) {
  try {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id,display_name")
      .eq("email", email)
      .maybeSingle();
    await supabase.from("contacts").upsert(
      {
        user_id: userId,
        email,
        contact_user_id: prof?.id ?? null,
        display_name: prof?.display_name ?? null,
      },
      { onConflict: "user_id,email" },
    );
  } catch {
    /* best-effort */
  }
}
