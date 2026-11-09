"use client";

import { useState, useTransition } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import type { Contact } from "@/lib/types";
import { addContact, removeContact } from "./actions";

export function ContactsManager({ initial }: { initial: Contact[] }) {
  const [contacts, setContacts] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await addContact(email, name);
      if (r?.error) setErr(r.error);
      else if (r?.contact) {
        setContacts((prev) => {
          const c = r.contact as Contact;
          const rest = prev.filter((x) => x.id !== c.id && x.email !== c.email);
          return [...rest, c].sort((a, b) => a.email.localeCompare(b.email));
        });
        setEmail("");
        setName("");
      }
    });
  }
  function remove(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    start(async () => {
      await removeContact(id);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-1.5 font-semibold text-card-foreground">
        <UserPlus className="h-4 w-4" /> Saved people
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        People you&rsquo;ve shared lists or groups with are saved here, so you can pick them when
        sharing instead of retyping an email. Add or remove anyone.
      </p>

      {contacts.length > 0 && (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 bg-background px-3 py-2">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {(c.display_name || c.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                {c.display_name && <span className="block truncate text-sm font-medium text-foreground">{c.display_name}</span>}
                <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
              </span>
              <button type="button" onClick={() => remove(c.id)} aria-label={`Remove ${c.email}`}
                className="flex-none text-muted-foreground transition-colors hover:text-brand-strong">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
          className="h-10 min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)"
          className="h-10 w-40 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring" />
        <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong">
          <Plus className="h-4 w-4" /> Save
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-brand-strong">{err}</p>}
    </div>
  );
}
