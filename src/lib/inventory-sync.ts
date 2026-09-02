import type { InventoryItem, StockMovementLog, StockMovementType, StockSelection } from "@/types/inventory";
import type { PurchaseReceipt } from "@/types/receipt";
import { MAX_STOCK_QUANTITY } from "./inventory-storage";

interface SyncOptions {
  now?: () => string;
  id?: () => string;
}

const defaultId = () => crypto.randomUUID();
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
const assertPositiveQty = (qty: number) => {
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_STOCK_QUANTITY) throw new Error("Jumlah stok tidak valid.");
};

export function syncStockFromPurchase(
  receipt: PurchaseReceipt,
  currentInventory: InventoryItem[],
  currentLogs: StockMovementLog[],
  options: SyncOptions = {},
): { updatedInventory: InventoryItem[]; logs: StockMovementLog[] } {
  if (currentLogs.some(log => log.type === "IN_PURCHASE" && log.sourceId === receipt.id)) {
    return { updatedInventory: currentInventory, logs: [] };
  }
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? defaultId;
  const updatedInventory = currentInventory.map(item => ({ ...item }));
  const logs: StockMovementLog[] = [];

  for (const receiptItem of receipt.items) {
    assertPositiveQty(receiptItem.qty);
    const conversion = receiptItem.unitConversion ?? 1;
    assertPositiveQty(conversion);
    const stockQty = receiptItem.qty * conversion;
    if (!Number.isFinite(stockQty) || stockQty > MAX_STOCK_QUANTITY) throw new Error("Jumlah stok tidak valid.");
    const cleanName = normalizeName(receiptItem.itemName);
    const existingIndex = updatedInventory.findIndex(item => item.id === receiptItem.inventoryItemId || normalizeName(item.name) === cleanName);
    const timestamp = now();
    let inventoryItem: InventoryItem;
    if (existingIndex >= 0) {
      const existing = updatedInventory[existingIndex];
      const incomingUnit = receiptItem.unit.trim();
      if (conversion === 1 && incomingUnit && incomingUnit.toLocaleLowerCase("id-ID") !== existing.unit.trim().toLocaleLowerCase("id-ID")) {
        throw new Error(`Satuan ${receiptItem.itemName.trim()} berbeda: stok memakai ${existing.unit}, struk memakai ${incomingUnit}.`);
      }
      if (existing.currentStock + stockQty > MAX_STOCK_QUANTITY) throw new Error("Jumlah stok melebihi batas aman.");
      inventoryItem = updatedInventory[existingIndex] = {
        ...existing,
        currentStock: existing.currentStock + stockQty,
        lastCostPrice: Math.round(receiptItem.unitPrice / conversion),
        updatedAt: timestamp,
      };
    } else {
      inventoryItem = {
        id: id(),
        name: receiptItem.itemName.trim().replace(/\s+/g, " "),
        currentStock: stockQty,
        unit: receiptItem.unit.trim() || "pcs",
        lastCostPrice: Math.round(receiptItem.unitPrice / conversion),
        minStockAlert: 3,
        updatedAt: timestamp,
      };
      updatedInventory.push(inventoryItem);
    }
    logs.push({
      id: id(), itemId: inventoryItem.id, itemName: inventoryItem.name,
      changeQty: stockQty, type: "IN_PURCHASE", sourceId: receipt.id,
      date: timestamp, notes: `Kulakan dari ${receipt.merchantName}`,
    });
  }
  return { updatedInventory, logs };
}

export function deductStockFromSale(
  selectedItems: StockSelection[],
  currentInventory: InventoryItem[],
  saleType: Extract<StockMovementType, "OUT_DEBT" | "OUT_CASH_SALE">,
  notes: string,
  sourceId: string,
  options: SyncOptions = {},
): { updatedInventory: InventoryItem[]; logs: StockMovementLog[] } {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? defaultId;
  const aggregated = new Map<string, number>();
  for (const selection of selectedItems) {
    assertPositiveQty(selection.qtySold);
    aggregated.set(selection.itemId, (aggregated.get(selection.itemId) ?? 0) + selection.qtySold);
  }
  for (const itemId of aggregated.keys()) {
    const item = currentInventory.find(candidate => candidate.id === itemId);
    if (!item) throw new Error("Barang stok tidak ditemukan.");

  }
  const timestamp = now();
  const updatedInventory = currentInventory.map(item => {
    const qty = aggregated.get(item.id);
    return qty ? { ...item, currentStock: item.currentStock - qty, updatedAt: timestamp } : { ...item };
  });
  const logs = [...aggregated].map(([itemId, qty]) => {
    const item = currentInventory.find(candidate => candidate.id === itemId)!;
    return { id: id(), itemId, itemName: item.name, changeQty: -qty, type: saleType, sourceId, date: timestamp, notes };
  });
  return { updatedInventory, logs };
}
