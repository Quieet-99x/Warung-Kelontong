"use client";

import { PackageSearch, Plus, ScanBarcode, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryItem, StockSelection } from "@/types/inventory";
import { searchItemNames } from "@/lib/item-search";

export function StockPicker({ inventory, value, onChange, onScan }: { inventory: InventoryItem[]; value: StockSelection[]; onChange: (value: StockSelection[]) => void; onScan?: () => void }) {
  const [search, setSearch] = useState("");
  const available = inventory.filter(item => item.currentStock > 0 && !value.some(selected => selected.itemId === item.id));
  const result = useMemo(() => searchItemNames(available, search), [available, search]);
  const add = (itemId: string) => itemId && onChange([...value, { itemId, qtySold: 1 }]);
  return <section className="stock-picker" aria-label="Pilih barang dari stok">
    <div className="stock-picker-heading"><PackageSearch size={18}/><div><strong>Barang dari stok</strong><small>Opsional. Stok berkurang hanya untuk barang yang dipilih.</small></div></div>
    {value.map(selection => {
      const item = inventory.find(candidate => candidate.id === selection.itemId);
      if (!item) return null;
      return <div className="stock-selection" key={`${item.id}-${selection.barcode ?? "manual"}`}>
        <span><strong>{item.name}</strong><small>{selection.unitName && selection.conversion ? `${selection.packageQty} ${selection.unitName} × ${selection.conversion} ${item.unit}` : `Tersedia ${item.currentStock} ${item.unit}`}</small>{selection.unitPrice !== undefined && <b>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(selection.unitPrice)}</b>}</span>
        <label>Qty<input aria-label={`Jumlah ${item.name}`} type="number" min="0.01" step="0.01" value={selection.qtySold} onChange={event => onChange(value.map(entry => entry === selection ? { ...entry, qtySold: Number(event.target.value), packageQty: undefined, conversion: undefined, unitPrice: undefined } : entry))}/></label>
        <button type="button" aria-label={`Hapus ${item.name} dari transaksi`} onClick={() => onChange(value.filter(entry => entry !== selection))}><X size={16}/></button>
      </div>;
    })}
    {available.length ? onScan ? <div className="stock-search-row"><label className="stock-search"><Search size={16}/><input type="search" aria-label="Cari barang dari stok" placeholder="Cari nama barang…" value={search} onChange={event => setSearch(event.target.value)}/></label><button className="stock-scan-button" type="button" aria-label="Scan barcode barang" onClick={onScan}><ScanBarcode size={19}/></button></div> : <label className="stock-add"><Plus size={16}/><select aria-label="Tambah barang dari stok" value="" onChange={event => add(event.target.value)}><option value="">Pilih barang…</option>{available.map(item => <option value={item.id} key={item.id}>{item.name} · {item.currentStock} {item.unit}</option>)}</select></label> : inventory.length ? <small className="stock-picker-empty">Semua barang tersedia sudah dipilih.</small> : <small className="stock-picker-empty">Belum ada master stok. Tambahkan melalui tab Stok.</small>}
    {onScan && search.trim() && result.matches.length > 0 && <div className="stock-search-results">{result.matches.slice(0, 5).map(item => <button type="button" key={item.id} aria-label={`Tambah ${item.name}`} onClick={() => { add(item.id); setSearch(""); }}><Plus size={15}/><span><strong>{item.name}</strong><small>{item.currentStock} {item.unit} tersedia</small></span></button>)}</div>}
    {onScan && search.trim() && !result.matches.length && result.suggestions.length > 0 && <div className="stock-search-suggestions"><span>Mungkin yang dimaksud:</span>{result.suggestions.map(item => <button type="button" key={item.id} aria-label={`Tambah ${item.name}`} onClick={() => { add(item.id); setSearch(""); }}>{item.name}</button>)}</div>}
    {onScan && search.trim() && !result.matches.length && !result.suggestions.length && <small className="stock-picker-empty">Barang tidak ditemukan di Stok.</small>}
  </section>;
}
