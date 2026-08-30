"use client";

import { BookOpenCheck, Landmark, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { useDailyClosingStore } from "@/hooks/useDailyClosingStore";
import { useKasbonStore } from "@/hooks/useKasbonStore";
import { usePurchaseStore } from "@/hooks/usePurchaseStore";
import { calculateDailyMetrics } from "@/lib/cashflow";
import CashflowDashboard from "./CashflowDashboard";
import { DashboardView } from "./Dashboard";
import { KulakanPageView } from "./KulakanPage";
import QuickCalculator from "./QuickCalculator";

type Page = "kasbon" | "kulakan" | "cashflow";

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function WarungApp() {
  const [page, setPage] = useState<Page>("kasbon");
  const [debtPrefill, setDebtPrefill] = useState<number | null>(null);
  const kasbonStore = useKasbonStore();
  const purchaseStore = usePurchaseStore();
  const closingStore = useDailyClosingStore();
  const today = localDate();
  const metrics = useMemo(() => calculateDailyMetrics(today, kasbonStore.debts, purchaseStore.purchases), [today, kasbonStore.debts, purchaseStore.purchases]);

  const createDebt = (amount: number) => {
    setDebtPrefill(amount);
    setPage("kasbon");
  };
  const addIncome = (amount: number) => closingStore.addIncome(today, amount, metrics);

  return <div className="warung-app">
    <div hidden={page !== "kasbon"}><DashboardView store={kasbonStore} debtPrefill={debtPrefill} onDebtPrefillConsumed={() => setDebtPrefill(null)}/></div>
    <div hidden={page !== "kulakan"}><KulakanPageView store={purchaseStore}/></div>
    <div hidden={page !== "cashflow"}><CashflowDashboard debts={kasbonStore.debts} receipts={purchaseStore.purchases} closingStore={closingStore}/></div>
    <QuickCalculator onCreateDebt={createDebt} onAddIncome={addIncome}/>
    <nav className="app-bottom-nav" aria-label="Navigasi utama">
      <button className={page === "kasbon" ? "active" : ""} onClick={() => setPage("kasbon")}><BookOpenCheck size={19}/><span>Kasbon</span></button>
      <button className={page === "kulakan" ? "active" : ""} onClick={() => setPage("kulakan")}><ReceiptText size={19}/><span>Kulakan</span></button>
      <button className={page === "cashflow" ? "active" : ""} onClick={() => setPage("cashflow")}><Landmark size={19}/><span>Buku Kas</span></button>
    </nav>
  </div>;
}
