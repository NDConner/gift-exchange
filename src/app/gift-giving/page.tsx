import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import type { GiftPurchase, GiftRecipient } from "@/lib/types";
import { GiftGiving, type ClaimedGift, type LinkableList } from "./gift-giving-client";

export const dynamic = "force-dynamic";

export default async function GiftGivingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Years the giver already has, plus the current year, newest first.
  const { data: yearRows } = await supabase.from("gift_recipients").select("year").eq("user_id", user.id);
  const thisYear = new Date().getFullYear();
  const existingYears = [...new Set([thisYear, ...(yearRows ?? []).map((r) => r.year)])];
  const sp = await searchParams;
  const requested = sp.year ? Number(sp.year) : NaN;
  // Allow any sane requested year (so a brand-new, still-empty year stays put).
  const year =
    Number.isInteger(requested) && requested >= 2000 && requested <= 2100
      ? requested
      : Math.max(...existingYears);
  const years = [...new Set([year, ...existingYears])].sort((a, b) => b - a);

  const { data: recipientsRaw } = await supabase
    .from("gift_recipients")
    .select("*")
    .eq("user_id", user.id)
    .eq("year", year)
    .order("position", { ascending: true });
  const recipients = (recipientsRaw ?? []) as GiftRecipient[];
  const recipientIds = recipients.map((r) => r.id);

  const { data: purchasesRaw } = recipientIds.length
    ? await supabase.from("gift_purchases").select("*").in("recipient_id", recipientIds)
    : { data: [] as GiftPurchase[] };
  const purchases = (purchasesRaw ?? []) as GiftPurchase[];
  const purchasesByRecipient: Record<string, GiftPurchase[]> = {};
  for (const p of purchases) (purchasesByRecipient[p.recipient_id] ??= []).push(p);

  // Auto-pull the giver's own claims on any linked list → shown as that
  // person's gifts. (Giver reads their own claims; owner-blindness untouched.)
  const linkedListIds = [...new Set(recipients.map((r) => r.linked_list_id).filter(Boolean))] as string[];
  const claimedGiftsByList: Record<string, ClaimedGift[]> = {};
  if (linkedListIds.length) {
    const { data: items } = await supabase
      .from("list_items")
      .select("id,title,list_id")
      .in("list_id", linkedListIds);
    const itemIds = (items ?? []).map((i) => i.id);
    const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i]));
    const { data: options } = itemIds.length
      ? await supabase.from("list_item_options").select("id,name,item_id").in("item_id", itemIds)
      : { data: [] as { id: string; name: string | null; item_id: string }[] };
    const optMap = Object.fromEntries((options ?? []).map((o) => [o.id, o]));
    const { data: claims } = itemIds.length
      ? await supabase
          .from("claims")
          .select("id,item_id,option_id,status")
          .eq("claimer_id", user.id)
          .in("item_id", itemIds)
      : { data: [] as { id: string; item_id: string; option_id: string | null; status: string }[] };
    for (const c of claims ?? []) {
      const item = itemMap[c.item_id];
      if (!item) continue;
      const label = c.option_id ? optMap[c.option_id]?.name ?? item.title : item.title;
      (claimedGiftsByList[item.list_id] ??= []).push({
        claim_id: c.id,
        label: label ?? "Gift",
        ww_status: c.status as "planning" | "purchased",
      });
    }
  }

  // Lists the giver can link a person to (anything shared with them).
  const { data: sharedLists } = await supabase
    .from("lists")
    .select("id,title,owner_id")
    .neq("owner_id", user.id);
  const ownerIds = [...new Set((sharedLists ?? []).map((l) => l.owner_id))];
  const { data: ownerProfs } = ownerIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const ownerName = Object.fromEntries((ownerProfs ?? []).map((p) => [p.id, p.display_name ?? "Someone"]));
  const lists: LinkableList[] = (sharedLists ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    owner_name: ownerName[l.owner_id] ?? "Someone",
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <GiftGiving
          key={year}
          year={year}
          years={years}
          recipients={recipients}
          purchasesByRecipient={purchasesByRecipient}
          claimedGiftsByList={claimedGiftsByList}
          lists={lists}
        />
      </main>
    </div>
  );
}
