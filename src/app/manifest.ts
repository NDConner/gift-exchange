import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — makes Wishing Well an installable app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wishing Well",
    short_name: "Wishing Well",
    description:
      "Make and share gift wishlists. Family and friends privately claim and coordinate gifts — without you ever finding out.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fdf8f5",
    theme_color: "#cf4d6f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
