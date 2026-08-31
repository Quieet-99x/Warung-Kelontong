import type { DebtItem, StoreProfile } from "@/types";
import type { DailyClosingRecord } from "@/types/cashflow";
import type { PurchaseReceipt } from "@/types/receipt";
import type { InventoryItem, ShoppingListItem, StockMovementLog } from "@/types/inventory";
import { parseStoredDebts, parseStoredStore } from "./storage";
import { parseStoredPurchases } from "./purchase-storage";
import { parseStoredDailyClosings } from "./cashflow";
import { INVENTORY_KEYS, parseStoredInventory, parseStoredShoppingList, parseStoredStockLogs } from "./inventory-storage";

export const STORAGE_KEYS = {
  store: "buku-kasbon.store.v1",
  debts: "buku-kasbon.debts.v1",
  receipts: "buku-kasbon.purchases.v1",
  dailyClosings: "daily_closings",
  inventory: INVENTORY_KEYS.inventory,
  stockLogs: INVENTORY_KEYS.logs,
  shoppingList: INVENTORY_KEYS.shoppingList,
} as const;

export const MAX_CHECKPOINT_BYTES = 5_000_000;

export interface BackupData {
  storeProfile: StoreProfile;
  debts: DebtItem[];
  receipts: PurchaseReceipt[];
  dailyClosings?: DailyClosingRecord[];
  inventory?: InventoryItem[];
  stockLogs?: StockMovementLog[];
  shoppingList?: ShoppingListItem[];
}

export interface Checkpoint {
  version: "1.0" | "2.0" | "3.0";
  backupDate: string;
  data: BackupData;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function spreadsheetSafe(value: string): string {
  const effectiveStart = value.replace(/^[\s\u0000-\u001f\u007f-\u009f\ufeff\u200b-\u200f\u202a-\u202e\u2060-\u206f]*/u, "");
  return /^[=+\-@]/.test(effectiveStart) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  return `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;
}

export function buildMonthlyCSV(monthYear: string, debts: DebtItem[], receipts: PurchaseReceipt[]): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear)) throw new Error("Bulan rekap tidak valid.");
  const monthlyDebts = debts.filter(debt => debt.createdAt.slice(0, 7) === monthYear);
  const monthlyReceipts = receipts.filter(receipt => receipt.purchaseDate.slice(0, 7) === monthYear);
  const statusLabel = { UNPAID: "Belum Lunas", PARTIAL: "Sebagian", PAID: "Lunas" } as const;
  const debtRows = monthlyDebts.map(debt => [
    debt.createdAt.slice(0, 10), debt.customerName, debt.phoneNumber, debt.itemsDescription,
    debt.totalAmount, debt.remainingAmount, statusLabel[debt.status],
  ].map(csvCell).join(","));
  const purchaseRows = monthlyReceipts.flatMap(receipt => receipt.items.map(item => [
    receipt.purchaseDate, receipt.merchantName, item.itemName, item.qty, item.unit,
    item.unitPrice, item.totalPrice,
  ].map(csvCell).join(",")));
  const totalKasbon = monthlyDebts.reduce((sum, debt) => sum + debt.totalAmount, 0);
  const totalSisa = monthlyDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const totalKulakan = monthlyReceipts.reduce((sum, receipt) => sum + receipt.grandTotal, 0);

  return "\ufeff" + [
    `=== REKAP CATATAN WARUNG BULAN: ${monthYear} ===`,
    "",
    "--- REKAP KASBON PELANGGAN ---",
    "Tanggal,Nama Pelanggan,No HP,Rincian Barang,Total Kasbon,Sisa Tagihan,Status",
    ...debtRows,
    "",
    "--- REKAP PENGELUARAN KULAKAN ---",
    "Tanggal,Toko Grosir,Nama Barang,Qty,Satuan,Harga Modal,Total Subtotal",
    ...purchaseRows,
    "",
    "--- RINGKASAN BULANAN ---",
    `Total Kasbon Dicatat,${totalKasbon}`,
    `Total Sisa Tagihan,${totalSisa}`,
    `Total Pengeluaran Kulakan,${totalKulakan}`,
  ].join("\r\n");
}

export function buildCheckpoint(data: BackupData, backupDate = new Date().toISOString()): string {
  const normalizedData = { ...data, dailyClosings: data.dailyClosings ?? [], inventory: data.inventory ?? [], stockLogs: data.stockLogs ?? [], shoppingList: data.shoppingList ?? [] };
  const checkpoint = JSON.stringify({ version: "3.0", backupDate, data: normalizedData } satisfies Checkpoint, null, 2);
  if (new TextEncoder().encode(checkpoint).byteLength > MAX_CHECKPOINT_BYTES) {
    throw new Error("File checkpoint terlalu besar untuk dicadangkan.");
  }
  return checkpoint;
}

const hasUniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

function parseAllDebts(value: unknown): DebtItem[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = parseStoredDebts(JSON.stringify(value));
  if (!parsed || parsed.length !== value.length || !hasUniqueIds(parsed.map(debt => debt.id))) return null;
  const paymentIds = parsed.flatMap(debt => debt.paymentHistory.map(payment => payment.id));
  return hasUniqueIds(paymentIds) ? parsed : null;
}

function parseAllReceipts(value: unknown): PurchaseReceipt[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = parseStoredPurchases(JSON.stringify(value));
  if (!parsed || parsed.length !== value.length || !hasUniqueIds(parsed.map(receipt => receipt.id))) return null;
  const totalsAreCanonical = parsed.every(receipt => {
    const itemTotalsAreCanonical = hasUniqueIds(receipt.items.map(item => item.id)) && receipt.items.every(item =>
      Number.isSafeInteger(item.qty * item.unitPrice) && item.totalPrice === item.qty * item.unitPrice,
    );
    const total = receipt.items.reduce((sum, item) => sum + item.totalPrice, 0);
    return itemTotalsAreCanonical && Number.isSafeInteger(total) && receipt.grandTotal === total;
  });
  return totalsAreCanonical ? parsed : null;
}

function parseAllDailyClosings(value: unknown): DailyClosingRecord[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = parseStoredDailyClosings(JSON.stringify(value));
  if (!parsed || parsed.length !== value.length) return null;
  if (!hasUniqueIds(parsed.map(record => record.id)) || !hasUniqueIds(parsed.map(record => record.date))) return null;
  return parsed.every(record => record.netCashflow === record.manualIncome + record.paidDebtsToday - record.totalExpenseToday)
    ? parsed
    : null;
}

function parseInventoryData(inventoryValue: unknown, logsValue: unknown, shoppingValue: unknown) {
  if (!Array.isArray(inventoryValue) || !Array.isArray(logsValue) || !Array.isArray(shoppingValue)) return null;
  const inventory = parseStoredInventory(JSON.stringify(inventoryValue));
  const stockLogs = parseStoredStockLogs(JSON.stringify(logsValue));
  const shoppingList = parseStoredShoppingList(JSON.stringify(shoppingValue));
  if (!inventory || !stockLogs || !shoppingList) return null;
  const itemIds = new Set(inventory.map(item => item.id));
  if (!stockLogs.every(log => itemIds.has(log.itemId)) || !shoppingList.every(item => itemIds.has(item.inventoryItemId))) return null;
  return { inventory, stockLogs, shoppingList };
}

export function parseCheckpoint(text: string): Checkpoint {
  if (new TextEncoder().encode(text).byteLength > MAX_CHECKPOINT_BYTES) {
    throw new Error("File checkpoint terlalu besar.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Format file checkpoint tidak valid.");
  }
  if (!isRecord(value) || (value.version !== "1.0" && value.version !== "2.0" && value.version !== "3.0")) throw new Error("Versi checkpoint tidak didukung.");
  if (typeof value.backupDate !== "string" || Number.isNaN(Date.parse(value.backupDate))) {
    throw new Error("Tanggal checkpoint tidak valid.");
  }
  if (!isRecord(value.data)) throw new Error("Data checkpoint tidak valid.");
  const storeProfile = parseStoredStore(JSON.stringify(value.data.storeProfile));
  const debts = parseAllDebts(value.data.debts);
  const receipts = parseAllReceipts(value.data.receipts);
  const dailyClosings = value.version === "1.0" ? [] : parseAllDailyClosings(value.data.dailyClosings);
  const inventoryData = value.version === "3.0"
    ? parseInventoryData(value.data.inventory, value.data.stockLogs, value.data.shoppingList)
    : { inventory: [], stockLogs: [], shoppingList: [] };
  if (!storeProfile || !debts || !receipts || !dailyClosings || !inventoryData) throw new Error("Data checkpoint tidak valid atau rusak.");
  return { version: value.version, backupDate: value.backupDate, data: { storeProfile, debts, receipts, dailyClosings, ...inventoryData } };
}

export function restoreCheckpoint(storage: StorageLike, data: BackupData): void {
  const previous = new Map<string, string | null>();
  const next = new Map<string, string>([
    [STORAGE_KEYS.store, JSON.stringify(data.storeProfile)],
    [STORAGE_KEYS.debts, JSON.stringify(data.debts)],
    [STORAGE_KEYS.receipts, JSON.stringify(data.receipts)],
    [STORAGE_KEYS.dailyClosings, JSON.stringify(data.dailyClosings ?? [])],
    [STORAGE_KEYS.inventory, JSON.stringify(data.inventory ?? [])],
    [STORAGE_KEYS.stockLogs, JSON.stringify(data.stockLogs ?? [])],
    [STORAGE_KEYS.shoppingList, JSON.stringify(data.shoppingList ?? [])],
  ]);
  for (const key of next.keys()) previous.set(key, storage.getItem(key));
  try {
    for (const [key, value] of next) storage.setItem(key, value);
    const writeVerified = [...next].every(([key, value]) => storage.getItem(key) === value);
    if (!writeVerified) throw new Error("Checkpoint tidak tersimpan lengkap.");
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Best effort rollback: preserve as much prior data as the browser permits.
      }
    }
    let rollbackVerified = false;
    try {
      rollbackVerified = [...previous].every(([key, value]) => storage.getItem(key) === value);
    } catch {
      rollbackVerified = false;
    }
    if (!rollbackVerified) {
      throw new Error("Gagal memulihkan checkpoint dan penyimpanan mungkin tidak konsisten. Jangan tutup aplikasi sebelum membuat salinan data yang masih terlihat.");
    }
    throw new Error("Gagal memulihkan checkpoint. Data sebelumnya berhasil dipertahankan.");
  }
}

export function readCurrentBackup(
  storage: Pick<StorageLike, "getItem">,
  fallback?: BackupData,
): BackupData {
  const storeRaw = storage.getItem(STORAGE_KEYS.store);
  const debtsRaw = storage.getItem(STORAGE_KEYS.debts);
  const receiptsRaw = storage.getItem(STORAGE_KEYS.receipts);
  const closingsRaw = storage.getItem(STORAGE_KEYS.dailyClosings);
  const inventoryRaw = storage.getItem(STORAGE_KEYS.inventory);
  const stockLogsRaw = storage.getItem(STORAGE_KEYS.stockLogs);
  const shoppingListRaw = storage.getItem(STORAGE_KEYS.shoppingList);
  const storeProfile = storeRaw !== null ? parseStoredStore(storeRaw) : fallback?.storeProfile ?? null;
  let debts = fallback?.debts ?? [];
  let receipts = fallback?.receipts ?? [];
  let dailyClosings = fallback?.dailyClosings ?? [];
  let inventory = fallback?.inventory ?? [];
  let stockLogs = fallback?.stockLogs ?? [];
  let shoppingList = fallback?.shoppingList ?? [];
  if (debtsRaw !== null) {
    try {
      const source: unknown = JSON.parse(debtsRaw);
      debts = parseAllDebts(source) ?? [];
      if (!Array.isArray(source) || debts.length !== source.length) throw new Error();
    } catch { throw new Error("Data kasbon saat ini tidak valid dan belum dapat dicadangkan."); }
  }
  if (receiptsRaw !== null) {
    try {
      const source: unknown = JSON.parse(receiptsRaw);
      receipts = parseAllReceipts(source) ?? [];
      if (!Array.isArray(source) || receipts.length !== source.length) throw new Error();
    } catch { throw new Error("Data kulakan saat ini tidak valid dan belum dapat dicadangkan."); }
  }
  if (closingsRaw !== null) {
    try {
      const source: unknown = JSON.parse(closingsRaw);
      dailyClosings = parseAllDailyClosings(source) ?? [];
      if (!Array.isArray(source) || dailyClosings.length !== source.length) throw new Error();
    } catch { throw new Error("Data tutup buku saat ini tidak valid dan belum dapat dicadangkan."); }
  }
  if (inventoryRaw !== null || stockLogsRaw !== null || shoppingListRaw !== null) {
    try {
      if (inventoryRaw === null || stockLogsRaw === null || shoppingListRaw === null) throw new Error();
      const parsed = parseInventoryData(JSON.parse(inventoryRaw), JSON.parse(stockLogsRaw), JSON.parse(shoppingListRaw));
      if (!parsed) throw new Error();
      ({ inventory, stockLogs, shoppingList } = parsed);
    } catch { throw new Error("Data inventori saat ini tidak valid atau tidak lengkap dan belum dapat dicadangkan."); }
  }
  if (!storeProfile) throw new Error("Profil warung saat ini tidak valid dan belum dapat dicadangkan.");
  return { storeProfile, debts, receipts, dailyClosings, inventory, stockLogs, shoppingList };
}

export function downloadTextFile(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
