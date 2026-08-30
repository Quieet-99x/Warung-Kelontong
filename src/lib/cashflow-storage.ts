import type { DailyClosingRecord, DailyMetrics } from "@/types/cashflow";

export const DAILY_CLOSINGS_KEY = "daily_closings";

interface CloseBooksInput {
  date: string;
  cashInDrawer: number;
  manualIncome: number;
  notes?: string;
  metrics: DailyMetrics;
  id: string;
  closedAt: string;
}

const assertAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Nominal buku kas tidak valid.");
};

const assertDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Tanggal buku kas tidak valid.");
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Tanggal buku kas tidak valid.");
  }
};

const assertMetrics = (metrics: DailyMetrics) => {
  assertAmount(metrics.paidDebtsToday);
  assertAmount(metrics.totalExpenseToday);
  assertAmount(metrics.newDebtsToday);
};

const isISOString = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === (value.includes(".") ? value : value.replace("Z", ".000Z"));
};

const buildRecord = (input: CloseBooksInput, existing?: DailyClosingRecord): DailyClosingRecord => {
  assertDate(input.date);
  if (!input.id.trim() || !isISOString(input.closedAt)) throw new Error("Identitas buku kas tidak valid.");
  if (input.notes && input.notes.length > 1000) throw new Error("Catatan buku kas terlalu panjang.");
  assertAmount(input.cashInDrawer);
  assertAmount(input.manualIncome);
  assertMetrics(input.metrics);
  const netCashflow = input.manualIncome + input.metrics.paidDebtsToday - input.metrics.totalExpenseToday;
  if (!Number.isSafeInteger(netCashflow)) throw new Error("Perhitungan arus kas melebihi batas aman.");
  return {
    id: existing?.id ?? input.id,
    date: input.date,
    cashInDrawer: input.cashInDrawer,
    manualIncome: input.manualIncome,
    paidDebtsToday: input.metrics.paidDebtsToday,
    totalExpenseToday: input.metrics.totalExpenseToday,
    newDebtsToday: input.metrics.newDebtsToday,
    netCashflow,
    notes: input.notes?.trim() || undefined,
    closedAt: input.closedAt,
  };
};

export function closeBooksForDate(records: DailyClosingRecord[], input: CloseBooksInput): DailyClosingRecord[] {
  const existing = records.find(record => record.date === input.date);
  const record = buildRecord(input, existing);
  return existing
    ? records.map(current => current.date === input.date ? record : current)
    : [record, ...records];
}

export function addIncomeToDate(
  records: DailyClosingRecord[],
  date: string,
  amount: number,
  metrics: DailyMetrics,
  id: string,
  closedAt: string,
): DailyClosingRecord[] {
  assertAmount(amount);
  if (amount === 0) throw new Error("Nominal omset harus lebih dari Rp0.");
  const existing = records.find(record => record.date === date);
  const income = (existing?.manualIncome ?? 0) + amount;
  if (!Number.isSafeInteger(income)) throw new Error("Akumulasi omset melebihi batas aman.");
  return closeBooksForDate(records, {
    date,
    cashInDrawer: existing?.cashInDrawer ?? 0,
    manualIncome: income,
    notes: existing?.notes,
    metrics,
    id,
    closedAt,
  });
}

export function writeDailyClosings(storage: Pick<Storage, "getItem" | "setItem">, records: DailyClosingRecord[]): boolean {
  try {
    const serialized = JSON.stringify(records);
    storage.setItem(DAILY_CLOSINGS_KEY, serialized);
    return storage.getItem(DAILY_CLOSINGS_KEY) === serialized;
  } catch {
    return false;
  }
}
