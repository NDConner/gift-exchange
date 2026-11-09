"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Bell, Check, CheckCheck, ExternalLink, Gift, PencilLine, Users } from "lucide-react";
import type { Notification } from "@/lib/types";
import { archiveNotification, markAllNotificationsRead, markNotificationRead } from "./actions";

const ICONS: Record<string, typeof Bell> = {
  list_shared: Users,
  item_added: Gift,
  item_changed: PencilLine,
  option_changed: PencilLine,
};

function when(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationsList({
  initial,
  listTitles,
}: {
  initial: Notification[];
  listTitles: Record<string, string>;
}) {
  const [notes, setNotes] = useState(initial);
  const unread = notes.filter((n) => !n.read_at).length;

  function markRead(id: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    void markNotificationRead(id);
  }
  function archive(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    void archiveNotification(id);
  }
  function readAll() {
    setNotes((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    void markAllNotificationsRead();
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
        <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 font-medium text-foreground">You&rsquo;re all caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">No notifications right now.</p>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {unread} unread
          </span>
          <button
            type="button"
            onClick={readAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {notes.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          return (
          <li
            key={n.id}
            className={`flex gap-3 rounded-2xl border p-4 ${
              n.read_at ? "border-border bg-card" : "border-brand/40 bg-brand/5"
            }`}
          >
            <span
              className={`mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-full ${
                n.read_at ? "bg-muted text-muted-foreground" : "bg-brand/15 text-brand-strong"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{n.body}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs text-muted-foreground">{when(n.created_at)}</span>
                {n.list_id && (
                  <Link
                    href={`/lists/${n.list_id}`}
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View {listTitles[n.list_id] ? `“${listTitles[n.list_id]}”` : "list"}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5">
              {!n.read_at && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Check className="h-3.5 w-3.5" /> Mark read
                </button>
              )}
              <button
                type="button"
                onClick={() => archive(n.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-brand-strong"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </button>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
