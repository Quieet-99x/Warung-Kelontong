import { describe, expect, it } from "vitest";
import { parseStoredPurchases } from "./purchase-storage";

const purchase = {
  id: "r1",
  merchantName: "Grosir Berkah",
  purchaseDate: "2026-08-30",
  items: [{
    id: "i1",
    itemName: "Minyak 1L",
    qty: 12,
    unit: "Pcs",
    totalPrice: 168000,
    unitPrice: 14000,
    recommendedSellPrice: 16500,
  }],
  grandTotal: 168000,
  createdAt: "2026-08-30T10:00:00.000Z",
};

describe("purchase storage", () => {
  it("accepts empty and valid purchase lists", () => {
    expect(parseStoredPurchases("[]")).toEqual([]);
    expect(parseStoredPurchases(JSON.stringify([purchase]))).toEqual([purchase]);
  });

  it("recovers valid purchases independently", () => {
    expect(parseStoredPurchases(JSON.stringify([purchase, { ...purchase, id: "bad", grandTotal: -1 }]))).toEqual([purchase]);
  });

  it.each([
    "not-json",
    "{}",
    JSON.stringify([{ ...purchase, purchaseDate: "invalid" }]),
    JSON.stringify([{ ...purchase, items: [] }]),
    JSON.stringify([{ ...purchase, items: [{ ...purchase.items[0], qty: 0 }] }]),
  ])("rejects unusable purchase payload %s", raw => {
    expect(parseStoredPurchases(raw)).toBeNull();
  });
});
