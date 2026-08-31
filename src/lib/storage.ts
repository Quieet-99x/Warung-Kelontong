import type { DebtItem, DebtStatus, PaymentRecord, StoreProfile } from "@/types";

const debtStatuses = new Set<DebtStatus>(["UNPAID", "PARTIAL", "PAID"]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
export const MAX_QRIS_DATA_URL_LENGTH = 800_000;
const QRIS_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function isValidQrisImage(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_QRIS_DATA_URL_LENGTH) return false;
  const match = QRIS_DATA_URL.exec(value);
  if (!match || match[1].length % 4 !== 0) return false;
  try {
    const binary = atob(match[1]);
    const type = value.slice(11, value.indexOf(";"));
    if (type === "png") return binary.startsWith("\x89PNG\r\n\x1a\n");
    if (type === "jpeg") return binary.startsWith("\xff\xd8\xff");
    if (type === "webp") return binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP";
    return false;
  } catch {
    return false;
  }
}

function isPaymentRecord(value: unknown): value is PaymentRecord {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isPositiveSafeInteger(value.amountPaid)
    && isValidDateString(value.paidAt);
}

function isDebtItem(value: unknown): value is DebtItem {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.id)
    || !isNonEmptyString(value.customerName)
    || !isNonEmptyString(value.phoneNumber)
    || !isNonEmptyString(value.itemsDescription)
    || !isPositiveSafeInteger(value.totalAmount)
    || !isNonNegativeSafeInteger(value.remainingAmount)
    || value.remainingAmount > value.totalAmount
    || !isNonEmptyString(value.status)
    || !debtStatuses.has(value.status as DebtStatus)
    || !isValidDateString(value.createdAt)
    || !Array.isArray(value.paymentHistory)
    || !value.paymentHistory.every(isPaymentRecord)) return false;

  if (value.dueDate !== undefined && !isValidDateString(value.dueDate)) return false;
  const paidAmount = value.paymentHistory.reduce((sum, payment) => sum + payment.amountPaid, 0);
  if (!Number.isSafeInteger(paidAmount) || paidAmount !== value.totalAmount - value.remainingAmount) return false;
  if (value.status === "UNPAID" && (value.remainingAmount !== value.totalAmount || value.paymentHistory.length > 0)) return false;
  if (value.status === "PARTIAL" && (value.remainingAmount <= 0 || value.remainingAmount >= value.totalAmount || value.paymentHistory.length === 0)) return false;
  if (value.status === "PAID" && value.remainingAmount !== 0) return false;
  if (value.status !== "PAID" && value.remainingAmount === 0) return false;
  return true;
}

export function parseStoredDebts(raw: string): DebtItem[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const validDebts = value.filter(isDebtItem);
    return value.length === 0 || validDebts.length > 0 ? validDebts : null;
  } catch {
    return null;
  }
}

export function parseStoredStore(raw: string): StoreProfile | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)
      || !isNonEmptyString(value.storeName)
      || !isNonEmptyString(value.ownerName)
      || (value.paymentInfo !== undefined && typeof value.paymentInfo !== "string")
      || (value.qrisImageBase64 !== undefined && !isValidQrisImage(value.qrisImageBase64))) return null;
    return {
      storeName: value.storeName,
      ownerName: value.ownerName,
      paymentInfo: value.paymentInfo as string | undefined,
      qrisImageBase64: value.qrisImageBase64 as string | undefined,
    };
  } catch {
    return null;
  }
}
