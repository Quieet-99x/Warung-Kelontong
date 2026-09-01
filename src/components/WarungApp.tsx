"use client";

import { BookOpenCheck, Boxes, Landmark, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDailyClosingStore } from "@/hooks/useDailyClosingStore";
import { useKasbonStore } from "@/hooks/useKasbonStore";
import { usePurchaseStore } from "@/hooks/usePurchaseStore";
import { PURCHASES_KEY } from "@/hooks/usePurchaseStore";
import { useInventoryStore } from "@/hooks/useInventoryStore";
import { useSingleWriterLock } from "@/hooks/useSingleWriterLock";
import { calculateDailyMetrics } from "@/lib/cashflow";
import { DAILY_CLOSINGS_KEY } from "@/lib/cashflow-storage";
import { APPLICATION_RESET_SIGNAL_KEY, SESSION_STORAGE_KEYS } from "@/lib/backup";
import type { StockSelection } from "@/types/inventory";
import CashflowDashboard from "./CashflowDashboard";
import { DashboardView } from "./Dashboard";
import { KulakanPageView } from "./KulakanPage";
import QuickCalculator from "./QuickCalculator";
import InventoryDashboard from "./InventoryDashboard";

type Page = "kasbon" | "kulakan" | "inventory" | "cashflow";

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function WarungApp() {
  const [page, setPage] = useState<Page>("kasbon");
  const [debtPrefill, setDebtPrefill] = useState<number | null>(null);
  const [debtStockPrefill, setDebtStockPrefill] = useState<StockSelection[]>([]);
  const writerLock = useSingleWriterLock();
  const kasbonStore = useKasbonStore(writerLock.canWrite);
  const purchaseStore = usePurchaseStore(writerLock.canWrite);
  const inventoryStore = useInventoryStore(writerLock.canWrite);
  const closingStore = useDailyClosingStore(writerLock.canWrite);
  const today = localDate();
  const metrics = useMemo(() => calculateDailyMetrics(today, kasbonStore.debts, purchaseStore.purchases), [today, kasbonStore.debts, purchaseStore.purchases]);
  const todayTurnover = closingStore.closings.find(closing => closing.date === today)?.manualIncome ?? 0;

  useEffect(() => {
    const receiveReset = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== APPLICATION_RESET_SIGNAL_KEY || !event.newValue) return;
      for (const key of Object.values(SESSION_STORAGE_KEYS)) sessionStorage.removeItem(key);
      window.location.reload();
    };
    window.addEventListener("storage", receiveReset);
    return () => window.removeEventListener("storage", receiveReset);
  }, []);

  const createDebt = (amount: number, stockItems: StockSelection[]) => {
    setDebtPrefill(amount);
    setDebtStockPrefill(stockItems);
    setPage("kasbon");
  };
  const addIncome = (amount: number, stockItems: StockSelection[]) => {
    if (!stockItems.length) return closingStore.addIncome(today, amount, metrics);
    if (!closingStore.canMutate()) return false;
    try {
      const nextClosings = closingStore.prepareIncome(today, amount, metrics);
      const saved = inventoryStore.deductSale(stockItems, "OUT_CASH_SALE", "Penjualan kasir", `cash-${crypto.randomUUID()}`, new Map([[DAILY_CLOSINGS_KEY, JSON.stringify(nextClosings)]]));
      if (saved) closingStore.acceptCommittedClosings(nextClosings);
      return saved;
    } catch { return false; }
  };
  const savePurchase = (receipt: Parameters<typeof purchaseStore.savePurchase>[0]) => {
    if (!purchaseStore.canMutate()) return false;
    const nextPurchases = purchaseStore.preparePurchase(receipt);
    const saved = inventoryStore.syncPurchase(receipt, new Map([[PURCHASES_KEY, JSON.stringify(nextPurchases)]]));
    if (saved) purchaseStore.acceptCommittedPurchases(nextPurchases);
    return saved;
  };

  return <div className="warung-app">
    {writerLock.status === "readonly" && <p className="writer-lock-banner" role="alert">Mode baca saja: aplikasi sedang aktif di tab lain. Tutup tab lain lalu muat ulang halaman ini untuk mencatat transaksi.</p>}
    {writerLock.status === "unsupported" && <p className="writer-lock-banner" role="alert">Mode baca saja: browser ini belum mendukung penguncian data yang aman. Gunakan Chrome, Edge, atau browser terbaru untuk mencatat transaksi.</p>}
    <div className="module-slot kasbon-slot" hidden={page !== "kasbon"}><DashboardView store={kasbonStore} todayTurnover={todayTurnover} debtPrefill={debtPrefill} debtStockPrefill={debtStockPrefill} inventoryStore={inventoryStore} onDebtPrefillConsumed={() => { setDebtPrefill(null); setDebtStockPrefill([]); }}/></div>
    <div hidden={page !== "kulakan"}><KulakanPageView store={purchaseStore} onSavePurchase={savePurchase}/></div>
    <div hidden={page !== "inventory"}><InventoryDashboard store={inventoryStore}/></div>
    <div hidden={page !== "cashflow"}><CashflowDashboard debts={kasbonStore.debts} receipts={purchaseStore.purchases} closingStore={closingStore}/></div>
    <QuickCalculator onCreateDebt={createDebt} onAddIncome={addIncome} inventory={inventoryStore.inventory} store={kasbonStore.store}/>
    <nav className="app-bottom-nav" aria-label="Navigasi utama">
      <button className={page === "kasbon" ? "active" : ""} onClick={() => setPage("kasbon")}><BookOpenCheck size={19}/><span>Kasbon</span></button>
      <button className={page === "kulakan" ? "active" : ""} onClick={() => setPage("kulakan")}><ReceiptText size={19}/><span>Kulakan</span></button>
      <button className={page === "inventory" ? "active" : ""} onClick={() => setPage("inventory")}><Boxes size={19}/><span>Stok</span></button>
      <button className={page === "cashflow" ? "active" : ""} onClick={() => setPage("cashflow")}><Landmark size={19}/><span>Buku Kas</span></button>
    </nav>
  </div>;
}
