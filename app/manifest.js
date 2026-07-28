import config from "@/config";

export default function manifest() {
  return {
    id: "/dashboard",
    name: "Legal Arena",
    short_name: "Legal Arena",
    description: config.appDescription,
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#020202",
    theme_color: "#020202",
    categories: ["games", "education"],
    lang: "en",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Open dashboard",
        short_name: "Dashboard",
        url: "/dashboard?source=pwa",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Android download",
        short_name: "Android",
        url: "/download/android",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}

