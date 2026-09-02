export type WholesaleUnitName = "Dus" | "Renceng" | "Pak" | "Bal";

export interface InventoryAlternateUnit {
  id: string;
  name: WholesaleUnitName;
  barcode: string;
  conversion: number;
  lastCostPrice: number;
  sellPrice: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  lastCostPrice: number;
  minStockAlert: number;
  updatedAt: string;
  baseBarcode?: string;
  baseSellPrice?: number;
  alternateUnits?: InventoryAlternateUnit[];
}

export type StockMovementType = "IN_PURCHASE" | "OUT_DEBT" | "OUT_CASH_SALE" | "MANUAL_ADJUST";

export interface StockMovementLog {
  id: string;
  itemId: string;
  itemName: string;
  changeQty: number;
  type: StockMovementType;
  date: string;
  notes?: string;
  sourceId?: string;
}

export interface StockSelection {
  itemId: string;
  qtySold: number;
  barcode?: string;
  unitName?: string;
  packageQty?: number;
  conversion?: number;
  unitPrice?: number;
}

export interface ShoppingListItem {
  id: string;
  inventoryItemId: string;
  itemName: string;
  checked: boolean;
  createdAt: string;
}
