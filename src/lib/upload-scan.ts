import { createClient } from "@/lib/supabase/client";

const BUCKET = "wallet-scans";
const MAX_BYTES = 15 * 1024 * 1024;

// Upload a scanned coupon/card photo to the PRIVATE wallet bucket. Returns the
// storage path (not a public URL) — read it back via a short-lived signed URL.
export async function uploadScan(file: File): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > MAX_BYTES) return { error: "That image is over 15 MB — pick a smaller one." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) return { error: error.message };
  return { path };
}

// Owner-only signed URL for displaying a stored scan (RLS gates it to the owner).
export async function signedScanUrl(path: string, expiresInSeconds = 120): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
