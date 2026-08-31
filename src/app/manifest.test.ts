import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA manifest", () => {
  it("is installable with the required identity and icons", () => {
    expect(manifest()).toMatchObject({
      name: "Buku Kasbon & Warung Digital",
      short_name: "Buku Warung",
      start_url: "/",
      display: "standalone",
      theme_color: "#059669",
      background_color: "#ffffff",
      icons: [
        { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  });
});
