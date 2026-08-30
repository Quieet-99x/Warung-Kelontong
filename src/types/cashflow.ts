export interface DailyClosingRecord {
  id: string;
  date: string;
  cashInDrawer: number;
  manualIncome: number;
  paidDebtsToday: number;
  totalExpenseToday: number;
  newDebtsToday: number;
  netCashflow: number;
  notes?: string;
  closedAt: string;
}

export interface MonthlyFinancialSummary {
  monthYear: string;
  totalGrossIncome: number;
  totalPurchases: number;
  estimatedGrossProfit: number;
  totalDebtsCollected: number;
  totalNewDebts: number;
}

export interface DailyMetrics {
  paidDebtsToday: number;
  totalExpenseToday: number;
  newDebtsToday: number;
}
