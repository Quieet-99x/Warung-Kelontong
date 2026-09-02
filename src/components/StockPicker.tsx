"use client";

import { PackageSearch, Plus, X } from "lucide-react";
import type { InventoryItem, StockSelection } from "@/types/inventory";

export function StockPicker({ inventory, value, onChange }: { inventory: InventoryItem[]; value: StockSelection[]; onChange: (value: StockSelection[]) => void }) {
  const available = inventory.filter(item => item.currentStock > 0 && !value.some(selected => selected.itemId === item.id));
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
    {available.length ? <label className="stock-add"><Plus size={16}/><select aria-label="Tambah barang dari stok" value="" onChange={event => add(event.target.value)}><option value="">Pilih barang…</option>{available.map(item => <option value={item.id} key={item.id}>{item.name} · {item.currentStock} {item.unit}</option>)}</select></label> : inventory.length ? <small className="stock-picker-empty">Semua barang tersedia sudah dipilih.</small> : <small className="stock-picker-empty">Belum ada master stok. Tambahkan melalui tab Stok atau scan struk kulakan.</small>}
  </section>;
}
