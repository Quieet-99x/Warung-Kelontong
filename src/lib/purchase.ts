import { applyMargin, parseReceiptExtraction } from "./receipt";
import type { PurchaseReceipt } from "@/types/receipt";

export function createPurchase(
  value: unknown,
  marginPercent: number,
  rounding: 500 | 1000,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): PurchaseReceipt {
  if (typeof value !== "object" || value === null || !("items" in value) || !Array.isArray(value.items)
    || value.items.some(item => typeof item !== "object" || item === null || !("unitPrice" in item)
      || !Number.isSafeInteger(item.unitPrice) || (item.unitPrice as number) <= 0)) {
    throw new Error("Harga modal hasil edit tidak valid");
  }
  const extraction = parseReceiptExtraction(value);
  const reconciledItems = extraction.items.map(item => {
    const totalPrice = item.qty * item.unitPrice;
    if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0) throw new Error("Total harga hasil edit tidak valid");
    return { ...item, totalPrice };
  });
  const grandTotal = reconciledItems.reduce((total, item) => total + item.totalPrice, 0);
  if (!Number.isSafeInteger(grandTotal) || grandTotal <= 0) throw new Error("Total belanja hasil edit tidak valid");
  return {
    ...extraction,
    id,
    items: applyMargin(reconciledItems, marginPercent, rounding),
    grandTotal,
    createdAt,
  };
}
