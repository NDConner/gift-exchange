"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { BarcodeImage } from "./barcode-image";
import { signedScanUrl } from "@/lib/upload-scan";
import type { WalletItem } from "@/lib/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="block truncate font-mono text-sm font-semibold text-foreground">{value}</span>
      </span>
      <span className="flex-none text-muted-foreground">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}</span>
    </button>
  );
}

// The "use it" view: a big scannable barcode/QR + copyable code + PIN + photo.
export function CodeDisplay({ item }: { item: WalletItem }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (item.image_path) signedScanUrl(item.image_path).then(setPhoto);
  }, [item.image_path]);
  const barcodeVal = item.barcode_value || item.code;

  return (
    <div className="space-y-3">
      {barcodeVal && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
          <BarcodeImage value={barcodeVal} format={item.barcode_format} />
          <span className="font-mono text-xs break-all text-muted-foreground">{barcodeVal}</span>
        </div>
      )}
      {item.code && <CopyField label="Code" value={item.code} />}
      {item.pin && <CopyField label="PIN" value={item.pin} />}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Saved scan" className="max-h-56 w-full rounded-xl border border-border object-contain" />
      )}
    </div>
  );
}
