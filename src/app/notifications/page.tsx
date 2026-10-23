import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { NotificationsList } from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS returns only this user's notifications. Hide archived ones.
  const { data: notes } = await supabase
    .from("notifications")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const list = (notes ?? []) as Notification[];

  const listIds = [...new Set(list.map((n) => n.list_id).filter(Boolean))] as string[];
  const { data: lists } = listIds.length
    ? await supabase.from("lists").select("id,title").in("id", listIds)
    : { data: [] as { id: string; title: string }[] };
  const listTitles: Record<string, string> = Object.fromEntries((lists ?? []).map((l) => [l.id, l.title]));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notifications</h1>
        <p className="mt-1 text-muted-foreground">
          When someone changes an item you&rsquo;ve claimed or purchased, it shows up here.
        </p>
        <div className="mt-6">
          <NotificationsList initial={list} listTitles={listTitles} />
        </div>
      </main>
    </div>
  );
}
