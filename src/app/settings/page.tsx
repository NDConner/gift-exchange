import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { ProfileForm } from "./profile-form";
import { ContactsManager } from "./contacts-manager";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,email,default_anonymous")
    .eq("id", user.id)
    .single();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("email", { ascending: true });

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

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">You</h2>
          <div className="mt-3 space-y-3 text-sm">
            <ProfileForm initialName={profile?.display_name ?? ""} />
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{profile?.email ?? user.email}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/account/password"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <KeyRound className="h-4 w-4" /> Change password
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-brand-strong"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>

        <ContactsManager initial={(contacts ?? []) as Contact[]} />

        <SettingsForm initialAnonymous={profile?.default_anonymous ?? false} />
      </main>
    </div>
  );
}
