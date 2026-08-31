import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("public/sw.js", "utf8");

describe("service worker app shell", () => {
  it("precaches Next.js chunks referenced by the first HTML response", () => {
    expect(source).toContain("matchAll");
    expect(source).toContain("/_next/static/");
    expect(source).toContain("cache.addAll");
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
