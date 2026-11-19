"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Renders a stored code as a scannable barcode or QR. Falls back to QR if the
// value isn't valid for the given 1D format.
export function BarcodeImage({ value, format }: { value: string; format?: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const wantQr = (format ?? "").toLowerCase() === "qr";

  useEffect(() => {
    let cancelled = false;
    const toQr = () =>
      QRCode.toDataURL(value, { margin: 1, width: 220 })
        .then((u) => !cancelled && setQr(u))
        .catch(() => {});
    if (wantQr) {
      toQr();
      return () => {
        cancelled = true;
      };
    }
    setQr(null);
    const f = (format ?? "").toLowerCase();
    const jsFmt = f === "upc" ? "UPC" : f === "ean" || f === "ean13" ? "EAN13" : "CODE128";
    try {
      if (svgRef.current) {
        JsBarcode(svgRef.current, value, { format: jsFmt, displayValue: false, margin: 8, height: 64, width: 2 });
      }
    } catch {
      toQr(); // invalid for that 1D symbology → QR fallback
    }
    return () => {
      cancelled = true;
    };
  }, [value, format, wantQr]);

  if (wantQr || qr) {
    return qr ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={qr} alt="Scannable code" className="h-44 w-44 rounded-lg bg-white p-2" />
    ) : null;
  }
  return (
    <div className="w-full max-w-xs rounded-lg bg-white p-2">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
