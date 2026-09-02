import type { InventoryItem, ShoppingListItem, StockMovementLog, StockMovementType } from "@/types/inventory";

export const INVENTORY_KEYS = {
  inventory: "warung_inventory",
  logs: "stock_logs",
  shoppingList: "warung_shopping_list",
} as const;
export const MAX_STOCK_QUANTITY = 1_000_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isDateTime = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_STOCK_QUANTITY;
const isStockQuantity = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= -MAX_STOCK_QUANTITY && value <= MAX_STOCK_QUANTITY;
const isNonNegativeMoney = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isBarcode = (value: unknown): value is string => typeof value === "string" && /^[0-9A-Za-z._-]{4,64}$/.test(value.trim());
const wholesaleUnits = ["Dus", "Renceng", "Pak", "Bal"];
const isAlternateUnit = (value: unknown) => isRecord(value) && isText(value.id)
  && wholesaleUnits.includes(value.name as string) && isBarcode(value.barcode)
  && Number.isSafeInteger(value.conversion) && (value.conversion as number) > 1 && (value.conversion as number) <= MAX_STOCK_QUANTITY
  && isNonNegativeMoney(value.lastCostPrice) && isNonNegativeMoney(value.sellPrice);

const hasUniqueIds = (values: { id: string }[]) => new Set(values.map(value => value.id)).size === values.length;

const isInventoryItem = (value: unknown): value is InventoryItem => isRecord(value)
  && isText(value.id) && isText(value.name) && isStockQuantity(value.currentStock) && isText(value.unit)
  && Number.isSafeInteger(value.lastCostPrice) && (value.lastCostPrice as number) >= 0
  && isNonNegative(value.minStockAlert) && isDateTime(value.updatedAt)
  && (value.baseBarcode === undefined || isBarcode(value.baseBarcode))
  && (value.baseSellPrice === undefined || isNonNegativeMoney(value.baseSellPrice))
  && (value.alternateUnits === undefined || (Array.isArray(value.alternateUnits) && value.alternateUnits.every(isAlternateUnit)
    && hasUniqueIds(value.alternateUnits as { id: string }[])));

const movementTypes: StockMovementType[] = ["IN_PURCHASE", "OUT_DEBT", "OUT_CASH_SALE", "MANUAL_ADJUST"];
const isStockLog = (value: unknown): value is StockMovementLog => {
  if (!isRecord(value) || !isText(value.id) || !isText(value.itemId) || !isText(value.itemName)
    || typeof value.changeQty !== "number" || !Number.isFinite(value.changeQty) || value.changeQty === 0
    || !movementTypes.includes(value.type as StockMovementType) || !isDateTime(value.date)
    || (value.notes !== undefined && typeof value.notes !== "string")
    || (value.sourceId !== undefined && !isText(value.sourceId))) return false;
  if (value.type === "IN_PURCHASE" && value.changeQty <= 0) return false;
  if ((value.type === "OUT_DEBT" || value.type === "OUT_CASH_SALE") && value.changeQty >= 0) return false;
  return true;
};
const isShoppingItem = (value: unknown): value is ShoppingListItem => isRecord(value)
  && isText(value.id) && isText(value.inventoryItemId) && isText(value.itemName)
  && typeof value.checked === "boolean" && isDateTime(value.createdAt);

function parseArray<T>(raw: string, validator: (value: unknown) => value is T): T[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(validator)) return null;
    const values = value as T[];
    return hasUniqueIds(values as { id: string }[]) ? values : null;
  } catch { return null; }
}

export const parseStoredInventory = (raw: string): InventoryItem[] | null => {
  const values = parseArray(raw, isInventoryItem);
  if (!values) return null;
  const names = values.map(item => item.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID"));
  const barcodes = values.flatMap(item => [item.baseBarcode, ...(item.alternateUnits ?? []).map(unit => unit.barcode)]).filter(Boolean) as string[];
  return new Set(names).size === names.length && new Set(barcodes).size === barcodes.length ? values : null;
};
export const parseStoredStockLogs = (raw: string) => parseArray(raw, isStockLog);
export const parseStoredShoppingList = (raw: string) => parseArray(raw, isShoppingItem);

export function hasValidInventoryReferences(inventory: InventoryItem[], logs: StockMovementLog[], shoppingList: ShoppingListItem[]): boolean {
  const itemIds = new Set(inventory.map(item => item.id));
  return logs.every(log => itemIds.has(log.itemId)) && shoppingList.every(item => itemIds.has(item.inventoryItemId));
}
