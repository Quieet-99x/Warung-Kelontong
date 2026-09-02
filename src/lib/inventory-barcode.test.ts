import { describe, expect, it } from "vitest";
import { addBarcodeSale, findInventoryByBarcode, purchaseLineFromBarcode } from "./inventory-barcode";
import type { InventoryItem } from "@/types/inventory";

const item: InventoryItem = {
  id: "indomie", name: "Indomie Goreng", currentStock: 85, unit: "Pcs",
  lastCostPrice: 2875, minStockAlert: 10, updatedAt: "2026-09-02T10:00:00.000Z",
  baseBarcode: "8998866200223", baseSellPrice: 3500,
  alternateUnits: [{ id: "dus", name: "Dus", barcode: "18998866200220", conversion: 40, lastCostPrice: 115000, sellPrice: 130000 }],
};

describe("inventory barcode mapping", () => {
  it("resolves both base and wholesale barcodes to one inventory item", () => {
    expect(findInventoryByBarcode([item], " 8998866200223 ")).toMatchObject({ item, unit: { name: "Pcs", conversion: 1, sellPrice: 3500 } });
    expect(findInventoryByBarcode([item], "18998866200220")).toMatchObject({ item, unit: { name: "Dus", conversion: 40, sellPrice: 130000 } });
  });

  it("adds a wholesale scan as one package while tracking base stock deduction", () => {
    const result = addBarcodeSale([], item, item.alternateUnits![0]);
    expect(result.selection).toEqual([{ itemId: "indomie", qtySold: 40, barcode: "18998866200220", unitName: "Dus", packageQty: 1, conversion: 40, unitPrice: 130000 }]);
    expect(result.totalAdded).toBe(130000);
  });

  it("builds a procurement line whose package price remains the cash expense", () => {
    expect(purchaseLineFromBarcode(item, item.alternateUnits![0], 2, "line-1")).toEqual({
      id: "line-1", itemName: "Indomie Goreng", inventoryItemId: "indomie", barcode: "18998866200220",
      qty: 2, unit: "Dus", unitConversion: 40, unitPrice: 115000, totalPrice: 230000, recommendedSellPrice: 130000,
    });
  });
});
