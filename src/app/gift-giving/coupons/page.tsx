import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import type { WalletItem } from "@/lib/types";
import { Coupons } from "./coupons-client";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase.from("wallet_items").select("*").order("created_at", { ascending: false });
  const wallet = (items ?? []) as WalletItem[];

  const { data: reds } = wallet.length
    ? await supabase.from("wallet_redemptions").select("wallet_item_id,amount")
    : { data: [] as { wallet_item_id: string; amount: number | null }[] };
  const usedByItem: Record<string, number> = {};
  for (const r of reds ?? []) if (r.amount) usedByItem[r.wallet_item_id] = (usedByItem[r.wallet_item_id] ?? 0) + Number(r.amount);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/gift-giving"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Gift Giving
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Coupons initial={wallet} usedByItem={usedByItem} aiConfigured={!!process.env.ANTHROPIC_API_KEY} />
      </main>
    </div>
  );
}
