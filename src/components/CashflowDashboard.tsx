"use client";

import { BanknoteArrowDown, BanknoteArrowUp, BookCheck, CalendarDays, Download, Landmark, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import type { DailyClosingStore } from "@/hooks/useDailyClosingStore";
import { buildCashflowMonthlyCSV, calculateDailyMetrics, calculateMonthlySummary } from "@/lib/cashflow";
import { downloadTextFile } from "@/lib/backup";
import { formatDate, formatIDR, parseIDRInput } from "@/lib/utils";
import { feedback } from "@/lib/feedback";
import type { DebtItem } from "@/types";
import type { PurchaseReceipt } from "@/types/receipt";
import { RevenueChart } from "./RevenueChart";

interface CashflowDashboardProps {
  debts: DebtItem[];
  receipts: PurchaseReceipt[];
  closingStore: DailyClosingStore;
}

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};
const currentMonth = () => localDate().slice(0, 7);
const compactIDR = (amount: number) => formatIDR(amount).replace(/\s/g, "");

export default function CashflowDashboard({ debts, receipts, closingStore }: CashflowDashboardProps) {
  const today = localDate();
  const [month, setMonth] = useState(currentMonth);
  const existing = closingStore.closings.find(closing => closing.date === today);
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null);
  const [cashDraft, setCashDraft] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const metrics = useMemo(() => calculateDailyMetrics(today, debts, receipts), [today, debts, receipts]);
  const summary = useMemo(() => calculateMonthlySummary(month, closingStore.closings, receipts, debts), [month, closingStore.closings, receipts, debts]);
  const income = incomeDraft ?? String(existing?.manualIncome ?? 0);
  const cash = cashDraft ?? String(existing?.cashInDrawer ?? 0);
  const notes = notesDraft ?? existing?.notes ?? "";
  const manualIncome = parseIDRInput(income);
  const netCashflow = manualIncome + metrics.paidDebtsToday - metrics.totalExpenseToday;
  const margin = summary.totalGrossIncome > 0 ? Math.round(summary.estimatedGrossProfit / summary.totalGrossIncome * 100) : 0;


  if (!closingStore.hydrated) return <main className="cashflow-page loading">Membuka buku kas…</main>;

  const saveClosing = () => {
    const saved = closingStore.closeBooks({
      date: today,
      cashInDrawer: parseIDRInput(cash),
      manualIncome,
      notes,
      metrics,
    });
    if (saved) {
      setIncomeDraft(null);
      setCashDraft(null);
      setNotesDraft(null);
      feedback.playKaching();
    }
    setStatus(saved ? "Tutup buku hari ini berhasil disimpan." : "Data belum tersimpan. Periksa ruang penyimpanan perangkat.");
  };
  const download = () => {
    const csv = buildCashflowMonthlyCSV(month, closingStore.closings, receipts, debts);
    downloadTextFile(csv, "text/csv;charset=utf-8", `Laporan_Keuangan_Warung_${month}.csv`);
    setStatus(`Laporan ${month} berhasil disiapkan.`);
  };

  return <main className="cashflow-page">
    <section className="cashflow-hero" data-theme="green">
      <h1>BUKU KAS & LAPORAN</h1>
      <RevenueChart month={month} closings={closingStore.closings} type={chartType} onTypeChange={setChartType}/>
      <button className="download-financial" type="button" onClick={download}><Download size={18}/> Download Laporan Bulanan (.csv)</button>
    </section>

    <section className="daily-cash-card">
      <div className="cashflow-title"><div><span>BUKU KAS HARI INI</span><h2>{formatDate(today)}</h2></div><CalendarDays size={24}/></div>
      <div className="auto-flow-list">
        <div><BanknoteArrowUp/><span>Kasbon ditagih hari ini</span><strong>+{compactIDR(metrics.paidDebtsToday)}</strong></div>
        <div><BanknoteArrowDown/><span>Belanja kulakan hari ini</span><strong>-{compactIDR(metrics.totalExpenseToday)}</strong></div>
        <div><WalletCards/><span>Kasbon baru hari ini</span><strong>{compactIDR(metrics.newDebtsToday)}</strong></div>
      </div>
      <div className="closing-inputs">
        <label><span>Omset penjualan hari ini</span><small>Terisi otomatis dari Kalkulator Kasir, tetap bisa dikoreksi.</small><input type="number" min="0" step="1" aria-label="Omset penjualan hari ini" value={income} onChange={event => setIncomeDraft(event.target.value)} inputMode="numeric"/></label>
        <label><span>Uang fisik di laci</span><small>Jumlah uang tunai yang benar-benar ada saat toko tutup.</small><input type="number" min="0" step="1" aria-label="Uang fisik di laci" value={cash} onChange={event => setCashDraft(event.target.value)} inputMode="numeric"/></label>
        <label><span>Catatan (opsional)</span><textarea value={notes} onChange={event => setNotesDraft(event.target.value)} placeholder="Contoh: ramai karena akhir pekan"/></label>
      </div>
      <div className={`net-flow${netCashflow < 0 ? " negative" : ""}`}><span>ESTIMASI ARUS KAS BERSIH HARI INI</span><strong>{netCashflow >= 0 ? "+" : "-"}{compactIDR(Math.abs(netCashflow))}</strong><small>Omset + kasbon tertagih − belanja kulakan</small></div>
      <button className="close-books-button" type="button" onClick={saveClosing}><BookCheck size={19}/> Simpan & Tutup Buku Hari Ini</button>
    </section>

    <section className="monthly-cash-card">
      <div className="cashflow-title"><div><span>REKAP KEUANGAN BULANAN</span><h2>Omset, modal & estimasi laba</h2></div><Landmark size={24}/></div>
      <label className="month-picker"><span>Pilih bulan</span><input type="month" value={month} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }}/></label>
      <div className="financial-metrics">
        <article><TrendingUp/><span>Total Omset Penjualan</span><strong>{compactIDR(summary.totalGrossIncome)}</strong></article>
        <article><TrendingDown/><span>Total Modal Kulakan</span><strong>{compactIDR(summary.totalPurchases)}</strong></article>
        <article className={summary.estimatedGrossProfit < 0 ? "loss" : "profit"}><Landmark/><span>Estimasi Laba Kotor</span><strong>{compactIDR(summary.estimatedGrossProfit)}</strong><small>Margin {margin}%</small></article>
      </div>
      <div className="receivable-health"><h3>Kesehatan Piutang</h3><div><span>Kasbon berhasil ditagih</span><strong>{compactIDR(summary.totalDebtsCollected)}</strong></div><div><span>Kasbon baru masih menggantung</span><strong>{compactIDR(summary.totalNewDebts)}</strong></div></div>
    </section>
    {status && <p className="cashflow-status" role="status">{status}</p>}
  </main>;
}
