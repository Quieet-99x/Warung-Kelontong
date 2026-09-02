import type { PurchaseReceipt, ReceiptItem } from "@/types/receipt";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const isPositiveMoney = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const isDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const isDateTime = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

function isReceiptItem(value: unknown): value is ReceiptItem {
  return isRecord(value)
    && isText(value.id)
    && isText(value.itemName)
    && isPositiveNumber(value.qty)
    && isText(value.unit)
    && isPositiveMoney(value.totalPrice)
    && isPositiveMoney(value.unitPrice)
    && (value.recommendedSellPrice === undefined || isPositiveMoney(value.recommendedSellPrice))
    && (value.inventoryItemId === undefined || isText(value.inventoryItemId))
    && (value.barcode === undefined || isText(value.barcode))
    && (value.unitConversion === undefined || (Number.isSafeInteger(value.unitConversion) && (value.unitConversion as number) >= 1));
}

function isPurchase(value: unknown): value is PurchaseReceipt {
  return isRecord(value)
    && isText(value.id)
    && isText(value.merchantName)
    && isDate(value.purchaseDate)
    && Array.isArray(value.items)
    && value.items.length > 0
    && value.items.every(isReceiptItem)
    && isPositiveMoney(value.grandTotal)
    && isDateTime(value.createdAt)
    && (value.rawImageUrl === undefined || typeof value.rawImageUrl === "string");
}

export function parseStoredPurchases(raw: string): PurchaseReceipt[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    if (!value.every(isPurchase)) return null;
    const purchases = value as PurchaseReceipt[];
    return new Set(purchases.map(purchase => purchase.id)).size === purchases.length ? purchases : null;
  } catch {
    return null;
  }
}
