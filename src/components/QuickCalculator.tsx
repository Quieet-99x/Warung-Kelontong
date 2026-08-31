"use client";

import { Calculator, CreditCard, PlusCircle, QrCode, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateCashierExpression } from "@/lib/cashflow";
import { formatIDR, parseIDRInput } from "@/lib/utils";
import { feedback } from "@/lib/feedback";
import type { InventoryItem, StockSelection } from "@/types/inventory";
import type { StoreProfile } from "@/types";
import { StockPicker } from "./StockPicker";
import QRISModal from "./QRISModal";

interface QuickCalculatorProps {
  onCreateDebt: (amount: number, stockItems: StockSelection[]) => void;
  onAddIncome: (amount: number, stockItems: StockSelection[]) => boolean;
  inventory?: InventoryItem[];
  store?: StoreProfile;
}

const compactIDR = (amount: number) => formatIDR(amount).replace(/\s/g, "");

const fallbackStore: StoreProfile = { storeName: "Warung", ownerName: "Pemilik Warung" };

export default function QuickCalculator({ onCreateDebt, onAddIncome, inventory = [], store = fallbackStore }: QuickCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [received, setReceived] = useState("");
  const [status, setStatus] = useState("");
  const [stockItems, setStockItems] = useState<StockSelection[]>([]);
  const [qrisOpen, setQrisOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const calculation = useMemo(() => {
    if (!expression.trim()) return { total: 0, error: "" };
    try { return { total: evaluateCashierExpression(expression), error: "" }; }
    catch { return { total: 0, error: "Ekspresi total belanjaan tidak valid." }; }
  }, [expression]);
  const total = calculation.total;
  const receivedAmount = parseIDRInput(received);
  const hasReceived = received.trim().length > 0;
  const change = Math.max(receivedAmount - total, 0);
  const shortfall = hasReceived && total > receivedAmount ? total - receivedAmount : 0;

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => fabRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const setQuickCash = (amount: number) => { feedback.triggerHaptic(10); setReceived(String(amount)); };
  const openCalculator = () => { setStatus(""); setOpen(true); };

  return <>
    <button ref={fabRef} className="calculator-fab" type="button" aria-label="Buka kalkulator kasir" onClick={openCalculator}><Calculator size={23}/></button>
    {status && !open && <p className="calculator-toast" role="status">{status}</p>}
    {open && !qrisOpen && <div className="calculator-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={panelRef} className="calculator-panel" role="dialog" aria-modal="true" aria-label="Kalkulator kasir cepat">
        <header><div><span>KASIR CEPAT</span><h2><Calculator size={20}/> Kalkulator & Kembalian</h2></div><button type="button" aria-label="Tutup kalkulator" onClick={() => close()}><X size={20}/></button></header>
        <div className="calculator-body">
          <label className="cashier-field"><span>Total belanjaan</span><input ref={inputRef} aria-label="Total belanjaan" aria-invalid={Boolean(calculation.error)} aria-describedby={calculation.error ? "cashier-expression-error" : "cashier-input-help"} value={expression} onChange={event => setExpression(event.target.value)} placeholder="14.000, 26.000 12.500 - 5.000" inputMode="decimal" autoComplete="off"/><small id="cashier-input-help">Pisahkan nominal dengan koma, spasi, atau strip. Semuanya akan dijumlahkan.</small><strong>{compactIDR(total)}</strong></label>
          {calculation.error && <p id="cashier-expression-error" className="calculator-error" role="alert">{calculation.error}</p>}
          <label className="cashier-field"><span>Uang diterima pembeli</span><input aria-label="Uang diterima pembeli" value={received} onChange={event => setReceived(event.target.value)} placeholder="Rp 100.000" inputMode="numeric"/></label>
          <StockPicker inventory={inventory} value={stockItems} onChange={setStockItems}/>
          <span className="shortcut-label">SHORTCUT UANG DITERIMA</span>
          <div className="cash-shortcuts" aria-label="Pilihan uang cepat">
            <button type="button" onClick={() => setQuickCash(total)} disabled={!total}>Pas</button>
            {[10_000, 20_000, 50_000, 100_000].map(value => <button type="button" key={value} onClick={() => setQuickCash(value)} disabled={!total}>{value / 1000}rb</button>)}
          </div>
          <div className={`change-card${shortfall ? " shortfall" : ""}`}><span>{!hasReceived ? "MASUKKAN UANG DITERIMA" : shortfall ? "UANG MASIH KURANG" : "UANG KEMBALIAN"}</span><strong>{compactIDR(shortfall || change)}</strong></div>
          <div className="calculator-actions"><span>AKSI CEPAT</span><div>
            <button type="button" disabled={!total} onClick={() => setQrisOpen(true)}><QrCode size={17}/> Tampilkan QRIS</button>
            <button type="button" disabled={!total} onClick={() => { onCreateDebt(total, stockItems); close(false); }}><CreditCard size={17}/> Catat Jadi Kasbon</button>
            <button type="button" disabled={!total} onClick={() => {
              const saved = onAddIncome(total, stockItems);
              setStatus(saved ? `${compactIDR(total)} ditambahkan ke omset hari ini.` : "Transaksi dan stok gagal disimpan. Periksa jumlah stok lalu coba lagi.");
              if (saved) { setExpression(""); setStockItems([]); close(); }
            }}><PlusCircle size={17}/> Tambah ke Omset Hari Ini</button>
          </div></div>
          {status && <p className="calculator-status" role="status">{status}</p>}
        </div>
      </section>
    </div>}
    <QRISModal open={qrisOpen} onClose={() => setQrisOpen(false)} store={store} amount={total}/>
  </>;
}
