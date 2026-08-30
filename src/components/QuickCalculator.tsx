"use client";

import { Calculator, CreditCard, PlusCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { evaluateCashierExpression } from "@/lib/cashflow";
import { formatIDR, parseIDRInput } from "@/lib/utils";

interface QuickCalculatorProps {
  onCreateDebt: (amount: number) => void;
  onAddIncome: (amount: number) => boolean;
}

const compactIDR = (amount: number) => formatIDR(amount).replace(/\s/g, "");

export default function QuickCalculator({ onCreateDebt, onAddIncome }: QuickCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [received, setReceived] = useState("");
  const [status, setStatus] = useState("");
  const total = useMemo(() => {
    try { return evaluateCashierExpression(expression); } catch { return 0; }
  }, [expression]);
  const receivedAmount = parseIDRInput(received);
  const hasReceived = received.trim().length > 0;
  const change = Math.max(receivedAmount - total, 0);
  const shortfall = hasReceived && total > receivedAmount ? total - receivedAmount : 0;

  const setQuickCash = (extra: number) => setReceived(String(total + extra));
  const resetAndClose = () => { setOpen(false); setStatus(""); };

  return <>
    <button className="calculator-fab" type="button" aria-label="Buka kalkulator kasir" onClick={() => setOpen(true)}><Calculator size={23}/></button>
    {open && <div className="calculator-backdrop" role="presentation">
      <section className="calculator-panel" role="dialog" aria-modal="true" aria-label="Kalkulator kasir cepat">
        <header><div><span>KASIR CEPAT</span><h2><Calculator size={20}/> Kalkulator & Kembalian</h2></div><button type="button" aria-label="Tutup kalkulator" onClick={resetAndClose}><X size={20}/></button></header>
        <div className="calculator-body">
          <label className="cashier-field"><span>Total belanjaan</span><input aria-label="Total belanjaan" value={expression} onChange={event => setExpression(event.target.value)} placeholder="14.000 + 26.000 + 12.500" inputMode="decimal"/><strong>{compactIDR(total)}</strong></label>
          <label className="cashier-field"><span>Uang diterima pembeli</span><input aria-label="Uang diterima pembeli" value={received} onChange={event => setReceived(event.target.value)} placeholder="Rp 100.000" inputMode="numeric"/></label>
          <div className="cash-shortcuts" aria-label="Pilihan uang cepat">
            <button type="button" onClick={() => setQuickCash(0)} disabled={!total}>Pas</button>
            {[10_000, 20_000, 50_000, 100_000].map(value => <button type="button" key={value} onClick={() => setQuickCash(value)} disabled={!total}>+{value / 1000}rb</button>)}
          </div>
          <div className={`change-card${shortfall ? " shortfall" : ""}`}><span>{!hasReceived ? "MASUKKAN UANG DITERIMA" : shortfall ? "UANG MASIH KURANG" : "UANG KEMBALIAN"}</span><strong>{compactIDR(shortfall || change)}</strong></div>
          <div className="calculator-actions"><span>AKSI CEPAT</span><div>
            <button type="button" disabled={!total} onClick={() => { onCreateDebt(total); resetAndClose(); }}><CreditCard size={17}/> Catat Jadi Kasbon</button>
            <button type="button" disabled={!total} onClick={() => {
              const saved = onAddIncome(total);
              setStatus(saved ? `${compactIDR(total)} ditambahkan ke omset hari ini.` : "Omset gagal disimpan di perangkat.");
              if (saved) { setExpression(""); setOpen(false); }
            }}><PlusCircle size={17}/> Tambah ke Omset Hari Ini</button>
          </div></div>
          {status && <p className="calculator-status" role="status">{status}</p>}
        </div>
      </section>
    </div>}
  </>;
}
