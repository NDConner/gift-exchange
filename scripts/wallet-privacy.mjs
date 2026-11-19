// WALLET PRIVACY TEST — a user's stored coupons/gift cards are private to them.
// Seeds a wallet_item + redemption owned by Gil, then asserts another signed-in
// user (Ivy) reads ZERO wallet rows and cannot modify them, while Gil sees his
// own. Exits non-zero on any failure.
//
// Run: node --env-file=.env.local scripts/wallet-privacy.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const failures = [];
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures.push(name);
}

async function userClient(email) {
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (le) throw new Error(`generateLink ${email}: ${le.message}`);
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error) throw new Error(`verifyOtp ${email}: ${error.message}`);
  return c;
}

const GIL = "gil.giver@example.com";
const IVY = "ivy.giver@example.com";

let itemId;
try {
  const { data: profs } = await admin.from("profiles").select("id, email").in("email", [GIL, IVY]);
  const id = (e) => profs.find((p) => p.email === e).id;

  // --- Setup: Gil stores a gift card (service role bypasses RLS) -------------
  const { data: item, error: ie } = await admin
    .from("wallet_items")
    .insert({
      user_id: id(GIL),
      kind: "gift_card",
      brand: "Sony",
      brand_domain: "sony.com",
      code: "SECRET-GIFTCARD-9999",
      pin: "4242",
      value_initial: 50,
      value_remaining: 50,
      status: "active",
    })
    .select()
    .single();
  if (ie) throw new Error(`insert wallet_item: ${ie.message}`);
  itemId = item.id;
  await admin.from("wallet_redemptions").insert({ user_id: id(GIL), wallet_item_id: itemId, amount: 10, note: "coffee" });

  // --- As GIL (owner): sees his own ----------------------------------------
  const gil = await userClient(GIL);
  const gItems = await gil.from("wallet_items").select("*");
  const gReds = await gil.from("wallet_redemptions").select("*");
  check("owner sees their own wallet item", (gItems.data?.length ?? 0) >= 1, `got ${gItems.data?.length}`);
  check("owner sees their own redemption", (gReds.data?.length ?? 0) >= 1, `got ${gReds.data?.length}`);
  check("owner can read the secret code", gItems.data?.some((r) => r.code === "SECRET-GIFTCARD-9999"));

  // --- As IVY (another user): sees NOTHING, cannot touch it -----------------
  const ivy = await userClient(IVY);
  const iAll = await ivy.from("wallet_items").select("*");
  const iById = await ivy.from("wallet_items").select("*").eq("id", itemId);
  const iReds = await ivy.from("wallet_redemptions").select("*").eq("wallet_item_id", itemId);
  const iUpd = await ivy.from("wallet_items").update({ code: "HACKED" }).eq("id", itemId).select();
  const iDel = await ivy.from("wallet_items").delete().eq("id", itemId).select();

  check("other user reads 0 wallet items (all)", (iAll.data?.length ?? -1) === 0, `got ${iAll.data?.length}`);
  check("other user cannot read the item by id", (iById.data?.length ?? -1) === 0, `got ${iById.data?.length}`);
  check("other user reads 0 redemptions", (iReds.data?.length ?? -1) === 0, `got ${iReds.data?.length}`);
  check("other user's UPDATE affects 0 rows", (iUpd.data?.length ?? -1) === 0, `got ${iUpd.data?.length}`);
  check("other user's DELETE affects 0 rows", (iDel.data?.length ?? -1) === 0, `got ${iDel.data?.length}`);

  // Confirm the code was NOT changed by Ivy's update attempt.
  const { data: after } = await admin.from("wallet_items").select("code").eq("id", itemId).single();
  check("code is unchanged after foreign UPDATE attempt", after?.code === "SECRET-GIFTCARD-9999", `got ${after?.code}`);
} finally {
  if (itemId) await admin.from("wallet_items").delete().eq("id", itemId); // cascades redemptions
}

console.log("");
if (failures.length) {
  console.error(`WALLET PRIVACY FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("WALLET PRIVACY PASSED ✅  (coupons/gift cards are private to their owner)");
