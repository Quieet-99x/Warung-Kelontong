import { describe, expect, it } from "vitest";
import { createPurchase } from "./purchase";

const extraction = {
  merchantName: "Grosir Berkah",
  purchaseDate: "2026-08-30",
  items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "Kg", totalPrice: 30000, unitPrice: 15000 }],
  grandTotal: 30000,
};

describe("createPurchase", () => {
  it("preserves inventory mapping metadata for a wholesale barcode purchase", () => {
    const result = createPurchase({
      merchantName: "Grosir", purchaseDate: "2026-09-02", grandTotal: 115000,
      items: [{ id: "line", itemName: "Indomie", qty: 1, unit: "Dus", unitPrice: 115000, totalPrice: 115000, inventoryItemId: "stock-1", barcode: "18990000000008", unitConversion: 40 }],
    }, 15, 500, "purchase-1", "2026-09-02T10:00:00.000Z");
    expect(result.items[0]).toMatchObject({ inventoryItemId: "stock-1", barcode: "18990000000008", unitConversion: 40 });
  });
  it("validates an edited receipt without adding selling recommendations", () => {
    const purchase = createPurchase(extraction, 15, 500, "r1", "2026-08-30T10:00:00.000Z");
    expect(purchase).toMatchObject({ id: "r1", merchantName: "Grosir Berkah", grandTotal: 30000 });
    expect(purchase.items[0].recommendedSellPrice).toBeUndefined();
  });

  it("reconciles edited quantities, unit prices, line totals, and grand total", () => {
    const purchase = createPurchase({
      ...extraction,
      grandTotal: 999999,
      items: [
        { ...extraction.items[0], qty: 3, unitPrice: 12000, totalPrice: 1 },
        { ...extraction.items[0], id: "i2", itemName: "Gula", qty: 2, unitPrice: 8000, totalPrice: 1 },
      ],
    }, 15, 500);
    expect(purchase.items.map(item => item.totalPrice)).toEqual([36000, 16000]);
    expect(purchase.grandTotal).toBe(52000);
  });

  it.each([
    { ...extraction, merchantName: " " },
    { ...extraction, purchaseDate: "invalid" },
    { ...extraction, items: [{ ...extraction.items[0], qty: 0 }] },
    { ...extraction, items: [{ ...extraction.items[0], unitPrice: Number.NaN }] },
  ])("rejects invalid edited receipt %#", value => {
    expect(() => createPurchase(value, 15, 500)).toThrow();
  });
});
