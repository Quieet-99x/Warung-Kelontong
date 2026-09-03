import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INVENTORY_KEYS } from "@/lib/inventory-storage";
import { useInventoryStore } from "./useInventoryStore";
import { createScopedStorage } from "@/lib/scoped-storage";

const item = { id: "s1", name: "Beras", currentStock: 2, unit: "kg", lastCostPrice: 15000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z" };

describe("useInventoryStore", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("persists and logs a verified manual adjustment", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.adjustStock("s1", 1, "Penyesuaian cepat")).toBe(true));
    expect(result.current.inventory[0].currentStock).toBe(3);
    expect(JSON.parse(localStorage.getItem(INVENTORY_KEYS.logs) ?? "[]")[0]).toMatchObject({ itemId: "s1", changeQty: 1, type: "MANUAL_ADJUST" });
  });

  it("commits inventory and linked sale writes atomically inside one account namespace", async () => {
    const storage = createScopedStorage(localStorage, "google-user-a");
    storage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    storage.setItem(INVENTORY_KEYS.logs, "[]");
    storage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore(true, storage));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => expect(result.current.deductSale(
      [{ itemId: "s1", qtySold: 1, unitName: "kg" }],
      "OUT_CASH_SALE",
      "Penjualan",
      "sale-1",
      new Map([["daily_closings", "[]"]]),
    )).toBe(true));

    expect(localStorage.getItem(INVENTORY_KEYS.inventory)).toBeNull();
    expect(JSON.parse(storage.getItem(INVENTORY_KEYS.inventory) ?? "[]")[0].currentStock).toBe(1);
    expect(storage.getItem("daily_closings")).toBe("[]");
  });

  it("does not overwrite an existing corrupt inventory key", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, "");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.addItem({ name: "Gula", currentStock: 2, unit: "pcs", lastCostPrice: 10000, minStockAlert: 3 })).toBe(false));
    expect(localStorage.getItem(INVENTORY_KEYS.inventory)).toBe("");
  });

  it("rejects a duplicate normalized manual item name", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.addItem({ name: "  BERAS  ", currentStock: 1, unit: "kg", lastCostPrice: 15000, minStockAlert: 3 })).toBe(false));
    expect(result.current.inventory).toEqual([item]);
  });

  it("links an unregistered wholesale barcode to an existing item", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.linkAlternateUnit("s1", { name: "Dus", barcode: "18990000000001", conversion: 12, lastCostPrice: 150000, sellPrice: 175000 })).toBe(true));
    expect(result.current.inventory[0].alternateUnits?.[0]).toMatchObject({ name: "Dus", barcode: "18990000000001", conversion: 12 });
  });

  it("keeps an orphan stock-log bundle read-only", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, JSON.stringify([{ id: "l1", itemId: "missing", itemName: "Hilang", changeQty: 1, type: "IN_PURCHASE", sourceId: "r1", date: "2026-08-31T10:00:00.000Z" }]));
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.adjustStock("s1", 1, "Coba")).toBe(false));
    expect(JSON.parse(localStorage.getItem(INVENTORY_KEYS.inventory) ?? "[]")[0].currentStock).toBe(2);
  });

  it("rehydrates a valid inventory bundle changed by another tab", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const changed = [{ ...item, currentStock: 7 }];
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify(changed));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: INVENTORY_KEYS.inventory })));
    await waitFor(() => expect(result.current.inventory[0].currentStock).toBe(7));
  });

  it("rejects quantities above the safe stock limit", async () => {
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => expect(result.current.adjustStock("s1", 1_000_000_001, "Tidak valid")).toBe(false));
    expect(result.current.inventory[0].currentStock).toBe(2);
  });

  it("removes only the selected shopping item through the atomic inventory bundle", async () => {
    const shopping = [
      { id: "shop-1", inventoryItemId: "s1", itemName: "Beras", checked: false, createdAt: "2026-08-31T10:00:00.000Z" },
      { id: "shop-2", inventoryItemId: "s1", itemName: "Beras cadangan", checked: true, createdAt: "2026-08-31T11:00:00.000Z" },
    ];
    localStorage.setItem(INVENTORY_KEYS.inventory, JSON.stringify([item]));
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, JSON.stringify(shopping));
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => expect(result.current.removeShoppingItem("shop-1")).toBe(true));

    expect(result.current.shoppingList).toEqual([shopping[1]]);
    expect(JSON.parse(localStorage.getItem(INVENTORY_KEYS.shoppingList) ?? "[]")).toEqual([shopping[1]]);
    expect(result.current.inventory).toEqual([item]);
  });

  it("locks further mutations and exposes an inconsistency warning when rollback cannot be verified", async () => {
    const inventoryRaw = JSON.stringify([item]);
    localStorage.setItem(INVENTORY_KEYS.inventory, inventoryRaw);
    localStorage.setItem(INVENTORY_KEYS.logs, "[]");
    localStorage.setItem(INVENTORY_KEYS.shoppingList, "[]");
    const { result } = renderHook(() => useInventoryStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === INVENTORY_KEYS.logs && value !== "[]") throw new Error("write failed");
      if (key === INVENTORY_KEYS.inventory && value === inventoryRaw && localStorage.getItem(key) !== inventoryRaw) return;
      originalSetItem.call(this, key, value);
    });
    act(() => expect(result.current.adjustStock("s1", 1, "Coba")).toBe(false));
    await waitFor(() => expect(result.current.storageIssue).toMatch(/mungkin tidak konsisten/i));
    act(() => expect(result.current.adjustStock("s1", 1, "Coba lagi")).toBe(false));
  });
});
