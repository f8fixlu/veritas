import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Veritas",
    short_name: "Veritas",
    description:
      "A simple and elegant online examination system with timed exams, subject enrollment and instant results.",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    orientation: "any",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["education"],
    icons: [
      {
        src: "/icons/veritas-current-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/veritas-current-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
