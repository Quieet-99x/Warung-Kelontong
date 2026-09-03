import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("public/sw.js", "utf8");

describe("service worker app shell", () => {
  it("does not cache authenticated HTML navigations", () => {
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("event.respondWith(fetch(request))");
    expect(source).not.toContain('cache.put("/"');
    expect(source).not.toContain('cache.match("/"');
  });

  it("precaches only public icons and manifest", () => {
    expect(source).toContain("BASE_SHELL");
    expect(source).toContain("cache.addAll(BASE_SHELL)");
  });

  it("bypasses every API request", () => {
    expect(source).toContain('url.pathname.startsWith("/api/")');
  });

  it("isolates deployment caches and activates only after an explicit message", () => {
    expect(source).toContain("searchParams.get");
    expect(source).toContain("SKIP_WAITING");
    expect(source).not.toContain('const CACHE_NAME = "buku-warung-shell-v');
    expect(source).not.toContain('cache.put("/", response.clone())');
  });
});
