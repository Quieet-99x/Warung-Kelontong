import type { ReceiptExtraction, ReceiptItem } from "@/types/receipt";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isMoney = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const isDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

export function roundSellPrice(unitPrice: number, marginPercent: number, rounding: 500 | 1000): number {
  if (!isMoney(unitPrice) || unitPrice <= 0 || !Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 500) {
    throw new Error("Perhitungan harga jual tidak valid");
  }
  return Math.ceil((unitPrice * (1 + marginPercent / 100)) / rounding) * rounding;
}

export function applyMargin(items: ReceiptItem[], marginPercent: number, rounding: 500 | 1000): ReceiptItem[] {
  return items.map(item => ({ ...item, recommendedSellPrice: roundSellPrice(item.unitPrice, marginPercent, rounding) }));
}

export function parseReceiptExtraction(value: unknown): ReceiptExtraction {
  if (!isRecord(value) || !isText(value.merchantName) || !isDate(value.purchaseDate) || !Array.isArray(value.items) || value.items.length === 0 || !isMoney(value.grandTotal)) {
    throw new Error("Hasil scan tidak lengkap atau tidak valid");
  }
  const items = value.items.map((candidate, index): ReceiptItem => {
    if (!isRecord(candidate) || !isText(candidate.itemName) || !isPositiveNumber(candidate.qty) || !isText(candidate.unit) || !isMoney(candidate.totalPrice) || candidate.totalPrice <= 0) {
      throw new Error(`Item hasil scan ke-${index + 1} tidak valid`);
    }
    const computedUnitPrice = Math.round(candidate.totalPrice / candidate.qty);
    const unitPrice = isMoney(candidate.unitPrice) && candidate.unitPrice > 0 ? candidate.unitPrice : computedUnitPrice;
    if (!Number.isSafeInteger(computedUnitPrice) || !Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
      throw new Error(`Harga item ke-${index + 1} tidak valid`);
    }
    const inventoryItemId = candidate.inventoryItemId === undefined ? undefined : isText(candidate.inventoryItemId) ? candidate.inventoryItemId.trim() : null;
    const barcode = candidate.barcode === undefined ? undefined : isText(candidate.barcode) ? candidate.barcode.trim() : null;
    const unitConversion = candidate.unitConversion === undefined ? undefined : Number.isSafeInteger(candidate.unitConversion) && (candidate.unitConversion as number) >= 1 ? candidate.unitConversion as number : null;
    if (inventoryItemId === null || barcode === null || unitConversion === null) throw new Error(`Mapping item ke-${index + 1} tidak valid`);
    return {
      id: crypto.randomUUID(),
      itemName: candidate.itemName.trim(),
      qty: candidate.qty,
      unit: candidate.unit.trim(),
      totalPrice: candidate.totalPrice,
      unitPrice,
      inventoryItemId,
      barcode,
      unitConversion,
    };
  });
  return { merchantName: value.merchantName.trim(), purchaseDate: value.purchaseDate, items, grandTotal: value.grandTotal };
}
