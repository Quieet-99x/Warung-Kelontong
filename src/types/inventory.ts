export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  lastCostPrice: number;
  minStockAlert: number;
  updatedAt: string;
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
}

export interface ShoppingListItem {
  id: string;
  inventoryItemId: string;
  itemName: string;
  checked: boolean;
  createdAt: string;
}
