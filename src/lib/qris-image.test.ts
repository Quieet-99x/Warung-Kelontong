import { describe, expect, it } from "vitest";
import { assertValidQrisUpload, calculateCropPreviewGeometry, calculateSquareCrop } from "./qris-image";

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

describe("QRIS crop", () => {
  it("calculates a centered square crop and applies zoom and offsets within bounds", () => {
    expect(calculateSquareCrop(1600, 1000, { zoom: 1, x: 0, y: 0 })).toEqual({ sx: 300, sy: 0, size: 1000 });
    expect(calculateSquareCrop(1600, 1000, { zoom: 2, x: 1, y: -1 })).toEqual({ sx: 1100, sy: 0, size: 500 });
    const preview = calculateCropPreviewGeometry(1600, 1000, { zoom: 2, x: 1, y: -1 });
    expect(preview.widthPercent).toBeCloseTo(320);
    expect(preview.heightPercent).toBeCloseTo(200);
    expect(preview.leftPercent).toBeCloseTo(-220);
    expect(preview.topPercent).toBeCloseTo(0);
  });
});
