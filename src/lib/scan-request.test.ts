import { describe, expect, it } from "vitest";
import { parseScanRequest } from "./scan-request";

const jpegBytes = String.fromCharCode(0xff, 0xd8, 0xff, 0xe0);
const tinyImage = `data:image/jpeg;base64,${btoa(jpegBytes)}`;

describe("scan request validation", () => {
  it("accepts a supported data URL and strips its prefix", () => {
    expect(parseScanRequest({ image: tinyImage })).toEqual({ mimeType: "image/jpeg", data: btoa(jpegBytes) });
  });

  it.each([
    null,
    {},
    { image: "" },
    { image: "data:text/plain;base64,SGVsbG8=" },
    { image: "data:image/svg+xml;base64,PHN2Zz4=" },
    { image: "data:image/jpeg;base64,not base64!" },
    { image: `data:image/jpeg;base64,${btoa("not-a-jpeg")}` },
  ])("rejects invalid image request %#", value => {
    expect(() => parseScanRequest(value)).toThrow();
  });

  it("rejects decoded images larger than 800 KB", () => {
    const oversized = `data:image/jpeg;base64,${"A".repeat(Math.ceil(800 * 1024 * 4 / 3) + 8)}`;
    expect(() => parseScanRequest({ image: oversized })).toThrow(/800 KB/);
  });
});
