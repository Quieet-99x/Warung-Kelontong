import { describe, expect, it } from "vitest";
import { assertValidQrisUpload } from "./qris-image";

describe("QRIS image upload", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s images", type => {
    expect(() => assertValidQrisUpload(new File(["image"], "qris", { type }))).not.toThrow();
  });

  it("rejects unsupported image formats", () => {
    expect(() => assertValidQrisUpload(new File(["<svg/>"] , "qris.svg", { type: "image/svg+xml" })))
      .toThrow(/PNG, JPEG, atau WebP/i);
  });

  it("rejects files larger than 10 MB before decoding", () => {
    expect(() => assertValidQrisUpload(new File([new Uint8Array(10_000_001)], "qris.png", { type: "image/png" })))
      .toThrow(/10 MB/i);
  });
});
