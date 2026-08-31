import { describe, expect, it } from "vitest";
import { parseStoredInventory, parseStoredShoppingList, parseStoredStockLogs } from "./inventory-storage";

const item = { id: "s1", name: "Beras", currentStock: 2, unit: "kg", lastCostPrice: 15000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z" };
const log = { id: "l1", itemId: "s1", itemName: "Beras", changeQty: 2, type: "IN_PURCHASE", sourceId: "r1", date: "2026-08-31T10:00:00.000Z" };
const shopping = { id: "b1", inventoryItemId: "s1", itemName: "Beras", checked: false, createdAt: "2026-08-31T10:00:00.000Z" };

describe("inventory storage validation", () => {
  it("accepts canonical inventory, logs, and shopping list", () => {
    expect(parseStoredInventory(JSON.stringify([item]))).toEqual([item]);
    expect(parseStoredStockLogs(JSON.stringify([log]))).toEqual([log]);
    expect(parseStoredShoppingList(JSON.stringify([shopping]))).toEqual([shopping]);
  });
  it("rejects negative stock, duplicate IDs or names, invalid movement signs, and invalid dates", () => {
    expect(parseStoredInventory(JSON.stringify([{ ...item, currentStock: -1 }]))).toBeNull();
    expect(parseStoredInventory(JSON.stringify([{ ...item, currentStock: 1_000_000_001 }]))).toBeNull();
    expect(parseStoredInventory(JSON.stringify([item, item]))).toBeNull();
    expect(parseStoredInventory(JSON.stringify([item, { ...item, id: "s2", name: "  BERAS  " }]))).toBeNull();
    expect(parseStoredStockLogs(JSON.stringify([{ ...log, changeQty: -2 }]))).toBeNull();
    expect(parseStoredShoppingList(JSON.stringify([{ ...shopping, createdAt: "invalid" }]))).toBeNull();
  });
});
