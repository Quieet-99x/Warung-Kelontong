import type { DebtItem, StoreProfile } from "@/types";
import type { PurchaseReceipt } from "@/types/receipt";
import { parseStoredDebts, parseStoredStore } from "./storage";
import { parseStoredPurchases } from "./purchase-storage";

export const STORAGE_KEYS = {
  store: "buku-kasbon.store.v1",
  debts: "buku-kasbon.debts.v1",
  receipts: "buku-kasbon.purchases.v1",
} as const;

export const MAX_CHECKPOINT_BYTES = 5_000_000;

export interface BackupData {
  storeProfile: StoreProfile;
  debts: DebtItem[];
  receipts: PurchaseReceipt[];
}

export interface Checkpoint {
  version: "1.0";
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
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
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
  return JSON.stringify({ version: "1.0", backupDate, data } satisfies Checkpoint, null, 2);
}

const hasUniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

function parseAllDebts(value: unknown): DebtItem[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = parseStoredDebts(JSON.stringify(value));
  return parsed && parsed.length === value.length && hasUniqueIds(parsed.map(debt => debt.id)) ? parsed : null;
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
  if (!isRecord(value) || value.version !== "1.0") throw new Error("Versi checkpoint tidak didukung.");
  if (typeof value.backupDate !== "string" || Number.isNaN(Date.parse(value.backupDate))) {
    throw new Error("Tanggal checkpoint tidak valid.");
  }
  if (!isRecord(value.data)) throw new Error("Data checkpoint tidak valid.");
  const storeProfile = parseStoredStore(JSON.stringify(value.data.storeProfile));
  const debts = parseAllDebts(value.data.debts);
  const receipts = parseAllReceipts(value.data.receipts);
  if (!storeProfile || !debts || !receipts) throw new Error("Data checkpoint tidak valid atau rusak.");
  return { version: "1.0", backupDate: value.backupDate, data: { storeProfile, debts, receipts } };
}

export function restoreCheckpoint(storage: StorageLike, data: BackupData): void {
  const previous = new Map<string, string | null>();
  const next = new Map<string, string>([
    [STORAGE_KEYS.store, JSON.stringify(data.storeProfile)],
    [STORAGE_KEYS.debts, JSON.stringify(data.debts)],
    [STORAGE_KEYS.receipts, JSON.stringify(data.receipts)],
  ]);
  for (const key of next.keys()) previous.set(key, storage.getItem(key));
  try {
    for (const [key, value] of next) storage.setItem(key, value);
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Best effort rollback: preserve as much prior data as the browser permits.
      }
    }
    throw new Error("Gagal memulihkan checkpoint. Data sebelumnya dipertahankan.");
  }
}

export function readCurrentBackup(
  storage: Pick<StorageLike, "getItem">,
  fallback?: BackupData,
): BackupData {
  const storeRaw = storage.getItem(STORAGE_KEYS.store);
  const debtsRaw = storage.getItem(STORAGE_KEYS.debts);
  const receiptsRaw = storage.getItem(STORAGE_KEYS.receipts);
  const storeProfile = storeRaw ? parseStoredStore(storeRaw) : fallback?.storeProfile ?? null;
  let debts = fallback?.debts ?? [];
  let receipts = fallback?.receipts ?? [];
  if (debtsRaw) {
    try {
      const source: unknown = JSON.parse(debtsRaw);
      debts = parseAllDebts(source) ?? [];
      if (!Array.isArray(source) || debts.length !== source.length) throw new Error();
    } catch {
      throw new Error("Data kasbon saat ini tidak valid dan belum dapat dicadangkan.");
    }
  }
  if (receiptsRaw) {
    try {
      const source: unknown = JSON.parse(receiptsRaw);
      receipts = parseAllReceipts(source) ?? [];
      if (!Array.isArray(source) || receipts.length !== source.length) throw new Error();
    } catch {
      throw new Error("Data kulakan saat ini tidak valid dan belum dapat dicadangkan.");
    }
  }
  if (!storeProfile) throw new Error("Profil warung saat ini tidak valid dan belum dapat dicadangkan.");
  return { storeProfile, debts, receipts };
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
