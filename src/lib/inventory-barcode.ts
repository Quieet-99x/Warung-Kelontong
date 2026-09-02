import type { InventoryAlternateUnit, InventoryItem, StockSelection } from "@/types/inventory";
import type { ReceiptItem } from "@/types/receipt";

export interface ResolvedInventoryUnit {
  id: "base" | string;
  name: string;
  barcode: string;
  conversion: number;
  lastCostPrice: number;
  sellPrice: number;
}

export const normalizeBarcode = (barcode: string) => barcode.trim();

export function inventoryUnits(item: InventoryItem): ResolvedInventoryUnit[] {
  const units: ResolvedInventoryUnit[] = [];
  if (item.baseBarcode) units.push({
    id: "base", name: item.unit, barcode: item.baseBarcode, conversion: 1,
    lastCostPrice: item.lastCostPrice, sellPrice: item.baseSellPrice ?? 0,
  });
  for (const unit of item.alternateUnits ?? []) units.push(unit);
  return units;
}

export function findInventoryByBarcode(inventory: InventoryItem[], barcode: string): { item: InventoryItem; unit: ResolvedInventoryUnit } | null {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;
  for (const item of inventory) {
    const unit = inventoryUnits(item).find(candidate => candidate.barcode === normalized);
    if (unit) return { item, unit };
  }
  return null;
}

export function hasBarcodeConflict(inventory: InventoryItem[], barcode: string, exceptItemId?: string): boolean {
  const normalized = normalizeBarcode(barcode);
  return Boolean(normalized && inventory.some(item => item.id !== exceptItemId && inventoryUnits(item).some(unit => unit.barcode === normalized)));
}

export function addBarcodeSale(current: StockSelection[], item: InventoryItem, unit: ResolvedInventoryUnit): { selection: StockSelection[]; totalAdded: number } {
  const matching = current.find(entry => entry.itemId === item.id && entry.barcode === unit.barcode);
  const line: StockSelection = {
    itemId: item.id,
    qtySold: (matching?.qtySold ?? 0) + unit.conversion,
    barcode: unit.barcode,
    unitName: unit.name,
    packageQty: (matching?.packageQty ?? 0) + 1,
    conversion: unit.conversion,
    unitPrice: unit.sellPrice,
  };
  return {
    selection: matching ? current.map(entry => entry === matching ? line : entry) : [...current, line],
    totalAdded: unit.sellPrice,
  };
}

export function purchaseLineFromBarcode(item: InventoryItem, unit: ResolvedInventoryUnit | InventoryAlternateUnit, packageQty: number, id = crypto.randomUUID()): ReceiptItem {
  return {
    id, itemName: item.name, inventoryItemId: item.id, barcode: unit.barcode,
    qty: packageQty, unit: unit.name, unitConversion: unit.conversion,
    unitPrice: unit.lastCostPrice, totalPrice: packageQty * unit.lastCostPrice,
    recommendedSellPrice: unit.sellPrice,
  };
}