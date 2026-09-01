import type { ReceiptExtraction } from "@/types/receipt";

export const DEBT_DRAFT_KEY = "buku-warung.draft.debt.v1";
export const PURCHASE_DRAFT_KEY = "buku-warung.draft.purchase.v1";

export interface DebtFormDraft {
  name: string;
  phone: string;
  items: string;
  amount: string;
  due: string;
}

export interface PurchaseFormDraft {
  draft: ReceiptExtraction;
  margin: number;
  rounding: 500 | 1000;
  identity: { id: string; createdAt: string };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const draftNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const percentage = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function parseDebt(value: unknown): DebtFormDraft | null {
  if (!record(value) || !text(value.name) || !text(value.phone) || !text(value.items) || !text(value.amount) || !text(value.due)) return null;
  return { name: value.name, phone: value.phone, items: value.items, amount: value.amount, due: value.due };
}

function parsePurchase(value: unknown): PurchaseFormDraft | null {
  if (!record(value) || !record(value.draft) || !text(value.draft.merchantName) || !date(value.draft.purchaseDate)
    || !Array.isArray(value.draft.items) || value.draft.items.length === 0 || !percentage(value.margin)
    || (value.rounding !== 500 && value.rounding !== 1000) || !record(value.identity)
    || !text(value.identity.id) || !text(value.identity.createdAt)) return null;
  const items = value.draft.items.map(item => {
    if (!record(item) || !text(item.id) || !text(item.itemName) || !draftNumber(item.qty) || !text(item.unit)
      || !draftNumber(item.unitPrice) || !draftNumber(item.totalPrice)) return null;
    return { id: item.id, itemName: item.itemName, qty: item.qty, unit: item.unit, unitPrice: item.unitPrice, totalPrice: item.totalPrice };
  });
  if (items.some(item => item === null)) return null;
  return {
    draft: { merchantName: value.draft.merchantName, purchaseDate: value.draft.purchaseDate, items: items as ReceiptExtraction["items"], grandTotal: positive(value.draft.grandTotal) ? value.draft.grandTotal : 0 },
    margin: value.margin,
    rounding: value.rounding,
    identity: { id: value.identity.id, createdAt: value.identity.createdAt },
  };
}

function read(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

export const readDebtDraft = () => parseDebt(read(DEBT_DRAFT_KEY));
export const readPurchaseDraft = () => parsePurchase(read(PURCHASE_DRAFT_KEY));

export function writeFormDraft(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return sessionStorage.getItem(key) === JSON.stringify(value);
  } catch { return false; }
}

export function clearFormDraft(key: string): boolean {
  try { sessionStorage.removeItem(key); return sessionStorage.getItem(key) === null; }
  catch { return false; }
}
