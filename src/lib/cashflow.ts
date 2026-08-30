import type { DebtItem } from "@/types";
import type { DailyClosingRecord, DailyMetrics, MonthlyFinancialSummary } from "@/types/cashflow";
import type { PurchaseReceipt } from "@/types/receipt";

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonNegativeAmount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const hasValidCalendarDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function tokenize(expression: string): Array<number | string> {
  const normalized = expression.replace(/[×]/g, "*").replace(/[÷]/g, "/").replace(/\s+/g, "");
  if (!normalized || /[^0-9.,+\-*/()]/.test(normalized)) throw new Error("Ekspresi belanja tidak valid.");
  const tokens: Array<number | string> = [];
  let index = 0;
  while (index < normalized.length) {
    const rest = normalized.slice(index);
    const number = rest.match(/^\d[\d.,]*/)?.[0];
    if (number) {
      let numeric: number;
      if (/^\d{1,3}(?:\.\d{3})+$/.test(number)) numeric = Number(number.replaceAll(".", ""));
      else if (/^\d+(?:[.,]\d+)?$/.test(number)) numeric = Number(number.replace(",", "."));
      else throw new Error("Ekspresi belanja tidak valid.");
      if (!Number.isFinite(numeric)) throw new Error("Ekspresi belanja tidak valid.");
      tokens.push(numeric);
      index += number.length;
      continue;
    }
    const operator = rest[0];
    if (!"+-*/()".includes(operator)) throw new Error("Ekspresi belanja tidak valid.");
    tokens.push(operator);
    index += 1;
  }
  return tokens;
}

export function evaluateCashierExpression(expression: string): number {
  const tokens = tokenize(expression);
  let position = 0;
  const parsePrimary = (): number => {
    const token = tokens[position++];
    if (typeof token === "number") return token;
    if (token === "(") {
      const value = parseAdditive();
      if (tokens[position++] !== ")") throw new Error("Ekspresi belanja tidak valid.");
      return value;
    }
    throw new Error("Ekspresi belanja tidak valid.");
  };
  const parseMultiplicative = (): number => {
    let value = parsePrimary();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = parsePrimary();
      if (operator === "/" && right === 0) throw new Error("Ekspresi belanja tidak valid.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseAdditive = (): number => {
    let value = parseMultiplicative();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = parseAdditive();
  if (position !== tokens.length || !Number.isSafeInteger(result) || result < 0) throw new Error("Ekspresi belanja tidak valid.");
  return result;
}

export function calculateDailyMetrics(targetDate: string, debts: DebtItem[], receipts: PurchaseReceipt[]): DailyMetrics {
  if (!hasValidCalendarDate(targetDate)) throw new Error("Tanggal buku kas tidak valid.");
  const paidDebtsToday = debts.reduce((total, debt) => total + debt.paymentHistory
    .filter(payment => payment.paidAt.slice(0, 10) === targetDate)
    .reduce((sum, payment) => sum + payment.amountPaid, 0), 0);
  const totalExpenseToday = receipts.filter(receipt => receipt.purchaseDate === targetDate)
    .reduce((sum, receipt) => sum + receipt.grandTotal, 0);
  const newDebtsToday = debts.filter(debt => debt.createdAt.slice(0, 10) === targetDate)
    .reduce((sum, debt) => sum + debt.totalAmount, 0);
  return { paidDebtsToday, totalExpenseToday, newDebtsToday };
}

export function calculateMonthlySummary(
  monthYear: string,
  dailyClosings: DailyClosingRecord[],
  receipts: PurchaseReceipt[],
  debts: DebtItem[],
): MonthlyFinancialSummary {
  if (!MONTH_PATTERN.test(monthYear)) throw new Error("Bulan laporan tidak valid.");
  const closings = dailyClosings.filter(closing => closing.date.startsWith(monthYear));
  const purchases = receipts.filter(receipt => receipt.purchaseDate.startsWith(monthYear));
  const newDebts = debts.filter(debt => debt.createdAt.startsWith(monthYear));
  const totalGrossIncome = closings.reduce((sum, closing) => sum + closing.manualIncome, 0);
  const totalPurchases = purchases.reduce((sum, receipt) => sum + receipt.grandTotal, 0);
  const estimatedGrossProfit = totalGrossIncome - totalPurchases;
  const totalDebtsCollected = debts.reduce((total, debt) => total + debt.paymentHistory
    .filter(payment => payment.paidAt.startsWith(monthYear))
    .reduce((sum, payment) => sum + payment.amountPaid, 0), 0);
  const totalNewDebts = newDebts.filter(debt => debt.status !== "PAID").reduce((sum, debt) => sum + debt.remainingAmount, 0);
  return { monthYear, totalGrossIncome, totalPurchases, estimatedGrossProfit, totalDebtsCollected, totalNewDebts };
}

function parseClosing(value: unknown): DailyClosingRecord | null {
  if (!isRecord(value)
    || typeof value.id !== "string" || value.id.trim() === ""
    || typeof value.date !== "string" || !hasValidCalendarDate(value.date)
    || !isNonNegativeAmount(value.cashInDrawer)
    || !isNonNegativeAmount(value.manualIncome)
    || !isNonNegativeAmount(value.paidDebtsToday)
    || !isNonNegativeAmount(value.totalExpenseToday)
    || !isNonNegativeAmount(value.newDebtsToday)
    || typeof value.netCashflow !== "number" || !Number.isSafeInteger(value.netCashflow)
    || value.netCashflow !== value.manualIncome + value.paidDebtsToday - value.totalExpenseToday
    || typeof value.closedAt !== "string" || Number.isNaN(Date.parse(value.closedAt))
    || (value.notes !== undefined && typeof value.notes !== "string")) return null;
  return {
    id: value.id,
    date: value.date,
    cashInDrawer: value.cashInDrawer,
    manualIncome: value.manualIncome,
    paidDebtsToday: value.paidDebtsToday,
    totalExpenseToday: value.totalExpenseToday,
    newDebtsToday: value.newDebtsToday,
    netCashflow: value.netCashflow,
    notes: value.notes,
    closedAt: value.closedAt,
  };
}

export function parseStoredDailyClosings(raw: string): DailyClosingRecord[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const parsed = value.map(parseClosing);
    if (parsed.some(record => record === null)) return null;
    const records = parsed as DailyClosingRecord[];
    const uniqueIds = new Set(records.map(record => record.id));
    const uniqueDates = new Set(records.map(record => record.date));
    return uniqueIds.size === records.length && uniqueDates.size === records.length ? records : null;
  } catch {
    return null;
  }
}

function spreadsheetSafe(value: string): string {
  const effectiveStart = value.replace(/^[\s\u0000-\u001f\u007f-\u009f\ufeff\u200b-\u200f\u202a-\u202e\u2060-\u206f]*/u, "");
  return /^[=+\-@]/.test(effectiveStart) ? `'${value}` : value;
}

const csvCell = (value: string | number) => typeof value === "number" ? String(value) : `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;

export function buildCashflowMonthlyCSV(monthYear: string, closings: DailyClosingRecord[], receipts: PurchaseReceipt[], debts: DebtItem[]): string {
  const summary = calculateMonthlySummary(monthYear, closings, receipts, debts);
  const rows = closings.filter(closing => closing.date.startsWith(monthYear)).map(closing => [
    closing.date, closing.manualIncome, closing.paidDebtsToday, closing.totalExpenseToday,
    closing.newDebtsToday, closing.netCashflow, closing.cashInDrawer, closing.notes ?? "",
  ].map(csvCell).join(","));
  return "\ufeff" + [
    `=== LAPORAN KEUANGAN WARUNG: ${monthYear} ===`, "",
    "--- RINGKASAN ---",
    `Total Omset,${summary.totalGrossIncome}`,
    `Total Modal Kulakan,${summary.totalPurchases}`,
    `Estimasi Laba Kotor,${summary.estimatedGrossProfit}`,
    `Kasbon Berhasil Ditagih,${summary.totalDebtsCollected}`,
    `Kasbon Baru Masih Gantung,${summary.totalNewDebts}`,
    "", "--- TUTUP BUKU HARIAN ---",
    "Tanggal,Omset Penjualan,Kasbon Ditagih,Belanja Kulakan,Kasbon Baru,Arus Kas Bersih,Uang Fisik di Laci,Catatan",
    ...rows,
  ].join("\r\n");
}
