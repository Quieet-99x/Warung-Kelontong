"use client";

import { Calculator, CreditCard, PlusCircle, QrCode, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { evaluateCashierExpression } from "@/lib/cashflow";
import { formatIDR, parseIDRInput } from "@/lib/utils";
import type { InventoryItem, StockSelection } from "@/types/inventory";
import type { StoreProfile } from "@/types";
import { StockPicker } from "./StockPicker";
import QRISModal from "./QRISModal";
import { BarcodeScanner } from "./BarcodeScanner";
import { addBarcodeSale, findInventoryByBarcode } from "@/lib/inventory-barcode";


interface QuickCalculatorProps {
  onCreateDebt: (amount: number, stockItems: StockSelection[]) => void;
  onAddIncome: (amount: number, stockItems: StockSelection[]) => boolean;
  inventory?: InventoryItem[];
  store?: StoreProfile;
  trigger?: "standalone" | "external";
}

export interface QuickCalculatorHandle {
  open: () => void;
}

const compactIDR = (amount: number) => formatIDR(amount).replace(/\s/g, "");

const fallbackStore: StoreProfile = { storeName: "Warung", ownerName: "Pemilik Warung" };

const QuickCalculator = forwardRef<QuickCalculatorHandle, QuickCalculatorProps>(function QuickCalculator({ onCreateDebt, onAddIncome, inventory = [], store = fallbackStore, trigger = "standalone" }, ref) {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [received, setReceived] = useState("");
  const [status, setStatus] = useState("");
  const [stockItems, setStockItems] = useState<StockSelection[]>([]);
  const [qrisOpen, setQrisOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const calculation = useMemo(() => {
    if (!expression.trim()) return { total: 0, error: "" };
    try { return { total: evaluateCashierExpression(expression), error: "" }; }
    catch { return { total: 0, error: "Ekspresi total belanjaan tidak valid." }; }
  }, [expression]);
  const total = calculation.total;
  const scannedTotal = stockItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * (item.packageQty ?? 0), 0);
  const effectiveTotal = total + scannedTotal;
  const receivedAmount = parseIDRInput(received);
  const hasReceived = received.trim().length > 0;
  const change = Math.max(receivedAmount - effectiveTotal, 0);
  const shortfall = hasReceived && effectiveTotal > receivedAmount ? effectiveTotal - receivedAmount : 0;

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

  const openCalculator = useCallback(() => { setStatus(""); setOpen(true); }, []);

  useImperativeHandle(ref, () => ({ open: openCalculator }), [openCalculator]);

  return <>
    {trigger === "standalone" && <button ref={fabRef} className="calculator-fab" type="button" aria-label="Buka kalkulator kasir" onClick={openCalculator}><Calculator size={23}/></button>}
    {status && !open && <p className="calculator-toast" role="status">{status}</p>}
    {open && !qrisOpen && !scannerOpen && <div className="calculator-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={panelRef} className="calculator-panel" role="dialog" aria-modal="true" aria-label="Kalkulator kasir cepat">
        <header><div><span>KASIR CEPAT</span><h2><Calculator size={20}/> Kalkulator & Kembalian</h2></div><button type="button" aria-label="Tutup kalkulator" onClick={() => close()}><X size={20}/></button></header>
        <div className="calculator-body">
          <label className="cashier-field"><span>Total belanjaan</span><input ref={inputRef} aria-label="Total belanjaan" aria-invalid={Boolean(calculation.error)} aria-describedby={calculation.error ? "cashier-expression-error" : "cashier-input-help"} value={expression} onChange={event => setExpression(event.target.value)} placeholder="14.000, 26.000 12.500 - 5.000" inputMode="decimal" autoComplete="off"/><small id="cashier-input-help">Pisahkan nominal dengan koma atau spasi. Gunakan tanda minus untuk diskon.</small></label>
          {calculation.error && <p id="cashier-expression-error" className="calculator-error" role="alert">{calculation.error}</p>}
          <StockPicker inventory={inventory} value={stockItems} onChange={setStockItems} onScan={() => setScannerOpen(true)}/>
          <label className="cashier-field"><span>Uang pembeli</span><input aria-label="Uang pembeli" value={received} onChange={event => setReceived(event.target.value)} placeholder="Rp 100.000" inputMode="numeric"/></label>
          <div className="cashier-summary cashier-summary-stacked">
            <div className="cashier-total"><span>TOTAL BELANJA</span><strong className="cashier-total-value">{compactIDR(effectiveTotal)}</strong></div>
            <div className={`change-card${shortfall ? " shortfall" : ""}`}><span>{!hasReceived ? "KEMBALIAN" : shortfall ? "UANG MASIH KURANG" : "UANG KEMBALIAN"}</span><strong className="cashier-change-value">{compactIDR(shortfall || change)}</strong></div>
          </div>
          <div className="calculator-actions"><span>AKSI CEPAT</span><div>
            <button className="cashier-complete" type="button" disabled={!effectiveTotal} onClick={() => {
              const saved = onAddIncome(effectiveTotal, stockItems);
              setStatus(saved ? `${compactIDR(effectiveTotal)} ditambahkan ke omset hari ini.` : "Transaksi dan stok gagal disimpan. Periksa jumlah stok lalu coba lagi.");
              if (saved) { setExpression(""); setStockItems([]); close(); }
            }}><PlusCircle size={17}/> Pesanan Selesai</button>
            <button className="cashier-qris" type="button" disabled={!effectiveTotal} onClick={() => setQrisOpen(true)}><QrCode size={17}/> Tampilkan QRIS</button>
            <button className="cashier-debt" type="button" disabled={!effectiveTotal} onClick={() => { onCreateDebt(effectiveTotal, stockItems); close(false); }}><CreditCard size={17}/> Tambahkan Kasbon</button>
          </div></div>
          {status && <p className="calculator-status" role="status">{status}</p>}
        </div>
      </section>
    </div>}

    <QRISModal open={qrisOpen} onClose={() => setQrisOpen(false)} store={store} amount={effectiveTotal}/>
    <BarcodeScanner open={scannerOpen} title="Scan barcode barang" onClose={() => setScannerOpen(false)} onDetected={barcode => {
      const resolved = findInventoryByBarcode(inventory, barcode);
      setScannerOpen(false);
      if (!resolved) { setStatus("Barcode belum terdaftar di Stok."); return; }
      if (resolved.item.currentStock < resolved.unit.conversion) { setStatus(`Stok ${resolved.item.name} tidak mencukupi.`); return; }
      setStockItems(current => addBarcodeSale(current, resolved.item, resolved.unit).selection);
      setStatus(`${resolved.item.name} ditambahkan dari hasil scan.`);
    }}/>
  </>;
});

export default QuickCalculator;
