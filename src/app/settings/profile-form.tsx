"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { setDisplayName } from "./actions";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    start(async () => {
      const r = await setDisplayName(name);
      if (r?.error) setErr(r.error);
      else {
        setName(r?.name ?? name);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">Name</span>
      {editing ? (
        <span className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-9 w-48 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
          />
          <button type="button" onClick={save} disabled={pending}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{name || "—"}</span>
          {saved && <span className="text-xs font-medium text-accent">Saved ✓</span>}
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </span>
      )}
      {err && <span className="text-xs text-brand-strong">{err}</span>}
    </div>
  );
}
