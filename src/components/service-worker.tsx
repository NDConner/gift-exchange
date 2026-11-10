"use client";

import { useEffect } from "react";

// Registers the PWA service worker so the app is installable on desktop + phone.
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort — the app works fine without it */
      });
    }
  }, []);
  return null;
}
