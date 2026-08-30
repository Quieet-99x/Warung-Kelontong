import { describe, expect, it } from "vitest";
import { applyMargin, parseReceiptExtraction, roundSellPrice } from "./receipt";

const extraction = {
  merchantName: "Toko Grosir Berkah",
  purchaseDate: "2026-08-30",
  items: [{ itemName: "Minyakita 1L", qty: 12, unit: "Pcs", totalPrice: 168000, unitPrice: 14000 }],
  grandTotal: 168000,
};

describe("receipt domain", () => {
  it.each([
    [14000, 15, 500, 16500],
    [14000, 15, 1000, 17000],
    [10000, 0, 500, 10000],
  ] as const)("rounds sell price %i with %i%% to %i as %i", (unitPrice, margin, rounding, expected) => {
    expect(roundSellPrice(unitPrice, margin, rounding)).toBe(expected);
  });

  it("applies margin recommendations without mutating OCR items", () => {
    const parsed = parseReceiptExtraction(extraction);
    const priced = applyMargin(parsed.items, 15, 500);
    expect(priced[0].recommendedSellPrice).toBe(16500);
    expect(parsed.items[0].recommendedSellPrice).toBeUndefined();
  });

  it("normalizes a valid OCR extraction and computes unit price", () => {
    const parsed = parseReceiptExtraction({
      ...extraction,
      items: [{ ...extraction.items[0], unitPrice: 0, qty: 3, totalPrice: 30000 }],
    });
    expect(parsed.items[0]).toMatchObject({ qty: 3, totalPrice: 30000, unitPrice: 10000 });
  });

  it.each([
    { ...extraction, merchantName: " " },
    { ...extraction, purchaseDate: "invalid" },
    { ...extraction, purchaseDate: "2026-02-31" },
    { ...extraction, items: [] },
    { ...extraction, items: [{ ...extraction.items[0], qty: 0 }] },
    { ...extraction, items: [{ ...extraction.items[0], totalPrice: Number.NaN }] },
    { ...extraction, grandTotal: -1 },
  ])("rejects unsafe OCR extraction %#", value => {
    expect(() => parseReceiptExtraction(value)).toThrow();
  });
});
