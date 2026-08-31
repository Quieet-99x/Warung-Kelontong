import { describe, expect, it } from "vitest";
import { deductStockFromSale, syncStockFromPurchase } from "./inventory-sync";
import type { InventoryItem, StockMovementLog } from "@/types/inventory";
import type { PurchaseReceipt } from "@/types/receipt";

const now = "2026-08-31T10:00:00.000Z";
const item: InventoryItem = {
  id: "stock-1", name: "Minyakita 1L", currentStock: 4, unit: "pcs",
  lastCostPrice: 14000, minStockAlert: 3, updatedAt: now,
};
const receipt: PurchaseReceipt = {
  id: "receipt-1", merchantName: "Grosir Berkah", purchaseDate: "2026-08-31",
  grandTotal: 84000, createdAt: now,
  items: [{ id: "line-1", itemName: "  MINYAKITA   1L ", qty: 6, unit: "Pcs", unitPrice: 14000, totalPrice: 84000 }],
};

const options = { now: () => now, id: (() => { let value = 0; return () => `id-${++value}`; })() };

describe("inventory synchronization", () => {
  it("adds a purchase to a normalized matching item and records its source", () => {
    const result = syncStockFromPurchase(receipt, [item], [], options);
    expect(result.updatedInventory).toEqual([{ ...item, currentStock: 10, updatedAt: now }]);
    expect(result.logs).toEqual([expect.objectContaining({
      itemId: "stock-1", itemName: "Minyakita 1L", changeQty: 6,
      type: "IN_PURCHASE", sourceId: "receipt-1", notes: "Kulakan dari Grosir Berkah",
    })]);
  });

  it("does not apply the same purchase twice", () => {
    const priorLog: StockMovementLog = {
      id: "log-1", itemId: "stock-1", itemName: item.name, changeQty: 6,
      type: "IN_PURCHASE", sourceId: receipt.id, date: now,
    };
    expect(syncStockFromPurchase(receipt, [item], [priorLog], options)).toEqual({ updatedInventory: [item], logs: [] });
  });

  it("creates a new item for a new purchase name", () => {
    const result = syncStockFromPurchase(receipt, [], [], options);
    expect(result.updatedInventory[0]).toMatchObject({ name: "MINYAKITA 1L", currentStock: 6, unit: "Pcs", lastCostPrice: 14000, minStockAlert: 3 });
    expect(result.logs[0].itemId).toBe(result.updatedInventory[0].id);
  });

  it("rejects a matched item when the OCR unit differs from the inventory unit", () => {
    const mismatched = { ...receipt, items: [{ ...receipt.items[0], unit: "kg" }] };
    expect(() => syncStockFromPurchase(mismatched, [item], [], options)).toThrow(/satuan/i);
    expect(item).toMatchObject({ currentStock: 4, unit: "pcs" });
  });

  it("deducts selected stock and logs the actual sale", () => {
    const result = deductStockFromSale([{ itemId: item.id, qtySold: 2 }], [item], "OUT_DEBT", "Kasbon Bu Siti", "debt-1", options);
    expect(result.updatedInventory[0].currentStock).toBe(2);
    expect(result.logs[0]).toMatchObject({ itemId: item.id, changeQty: -2, type: "OUT_DEBT", sourceId: "debt-1", notes: "Kasbon Bu Siti" });
  });

  it("rejects the entire deduction when stock is insufficient", () => {
    expect(() => deductStockFromSale([{ itemId: item.id, qtySold: 5 }], [item], "OUT_CASH_SALE", "Kasir", "sale-1", options))
      .toThrow(/stok Minyakita 1L tidak cukup/i);
    expect(item.currentStock).toBe(4);
  });
});
