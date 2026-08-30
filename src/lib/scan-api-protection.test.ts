import { describe, expect, it } from "vitest";
import { checkOrigin, createRateLimiter, readLimitedBody } from "./scan-api-protection";

describe("scan API protection", () => {
  it("allows same-origin requests and rejects cross-origin requests", () => {
    expect(checkOrigin(new Request("https://warung.test/api", { headers: { origin: "https://warung.test" } }))).toBe(true);
    expect(checkOrigin(new Request("https://warung.test/api", { headers: { origin: "https://evil.test" } }))).toBe(false);
  });

  it("limits repeated requests per client within a window", () => {
    const allow = createRateLimiter(2, 60_000);
    expect(allow("client", 0)).toBe(true);
    expect(allow("client", 1)).toBe(true);
    expect(allow("client", 2)).toBe(false);
    expect(allow("client", 60_001)).toBe(true);
  });

  it("stops reading a streamed body after the byte limit", async () => {
    const request = new Request("https://warung.test/api", { method: "POST", body: "123456789" });
    await expect(readLimitedBody(request, 8)).rejects.toThrow(/terlalu besar/);
  });
});
