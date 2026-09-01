"use client";

import { AlertTriangle, Check, ClipboardList, History, Package, PackagePlus, Pencil, Plus, Search, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import type { useInventoryStore } from "@/hooks/useInventoryStore";
import { MAX_STOCK_QUANTITY } from "@/lib/inventory-storage";
import { formatIDR } from "@/lib/utils";
import type { InventoryItem } from "@/types/inventory";
import { Modal } from "./Modal";

export type InventoryStore = ReturnType<typeof useInventoryStore>;
type EditState = InventoryItem | "new" | null;

export default function InventoryDashboard({ store }: { store: InventoryStore }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [edit, setEdit] = useState<EditState>(null);
  const [status, setStatus] = useState("");
  const list = useMemo(() => store.inventory.filter(item => {
    const matches = item.name.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"));
    return matches && (filter === "all" || item.currentStock <= item.minStockAlert);
  }), [filter, search, store.inventory]);

  const report = (saved: boolean, success: string) => setStatus(saved ? success : "Perubahan stok belum dapat disimpan di perangkat.");
  if (!store.hydrated) return <main className="inventory-page loading">Membuka data stok…</main>;

  return <main className="inventory-page">
    <section className="inventory-hero"><div className="eyebrow"><Package size={14}/> INVENTORI OTOMATIS</div><h1>Manajemen stok</h1><p>Stok masuk dari kulakan dan stok keluar dari transaksi tercatat otomatis dalam satu alur.</p><div className="inventory-stats"><span><strong>{store.inventory.length}</strong> barang</span><span className={store.lowStock.length ? "warning" : ""}><strong>{store.lowStock.length}</strong> menipis</span></div></section>
    <section className="inventory-content">
      {store.storageIssue && <p className="inventory-status" role="alert">{store.storageIssue}</p>}
      {status && <p className="inventory-status" role="status">{status}</p>}
      <div className="inventory-tools"><label><Search size={18}/><input aria-label="Cari nama barang" placeholder="Cari nama barang…" value={search} onChange={event => setSearch(event.target.value)}/></label><button type="button" onClick={() => setEdit("new")}><Plus size={18}/> Barang</button></div>
      <nav className="inventory-filters" aria-label="Filter stok"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Semua <b>{store.inventory.length}</b></button><button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}><AlertTriangle size={15}/> Stok menipis <b>{store.lowStock.length}</b></button></nav>
      <div className="inventory-list">{list.map(item => {
        const low = item.currentStock <= item.minStockAlert;
        return <article className={`inventory-card${low ? " low" : ""}`} key={item.id} aria-label={item.name}>
          <div className="inventory-card-head"><div className="inventory-icon"><Package size={20}/></div><div><h2>{item.name}</h2><p>Modal terakhir {formatIDR(item.lastCostPrice)} / {item.unit}</p></div><div className="stock-number" aria-label={`Sisa stok ${item.currentStock} ${item.unit}`}>
            {low && <div className="stock-indicators">
              <span className="stock-warning-icon" role="img" aria-label={`Stok menipis, batas minimum ${item.minStockAlert} ${item.unit}`}><AlertTriangle aria-hidden="true" size={17}/></span>
              <button className="shopping-icon" type="button" aria-label={`Tambah ${item.name} ke checklist belanja`} onClick={() => report(store.addToShoppingList(item.id), `${item.name} ditambahkan ke checklist belanja.`)}><ShoppingCart aria-hidden="true" size={17}/></button>
            </div>}
            <strong>{item.currentStock}</strong><small>{item.unit}</small>
          </div></div>
          <div className="inventory-actions"><button onClick={() => report(store.adjustStock(item.id, -1, "Penyesuaian cepat -1"), `Stok ${item.name} dikurangi 1.`)} disabled={item.currentStock < 1}>-1</button><button onClick={() => report(store.adjustStock(item.id, 1, "Penyesuaian cepat +1"), `Stok ${item.name} ditambah 1.`)}>+1</button><button onClick={() => setEdit(item)}><Pencil size={15}/> Edit stok</button></div>
        </article>;
      })}{!list.length && <div className="inventory-empty"><PackagePlus size={30}/><h2>{filter === "low" ? "Tidak ada stok menipis" : "Belum ada barang"}</h2><p>{filter === "low" ? "Semua stok berada di atas batas minimum." : "Scan struk kulakan atau tambahkan barang secara manual."}</p></div>}</div>
      <section className="shopping-panel"><div className="inventory-section-title"><ClipboardList size={19}/><div><span>CHECKLIST BELANJA</span><h2>Belanja pasar berikutnya</h2></div></div>{store.shoppingList.length ? store.shoppingList.map(item => <label className={item.checked ? "checked" : ""} key={item.id}><input type="checkbox" checked={item.checked} onChange={() => report(store.toggleShoppingItem(item.id), "Checklist belanja diperbarui.")}/><Check size={15}/><span>{item.itemName}</span></label>) : <p>Barang menipis yang ditambahkan akan muncul di sini.</p>}</section>
      <section className="inventory-log"><div className="inventory-section-title"><History size={19}/><div><span>AKTIVITAS TERBARU</span><h2>Pergerakan stok</h2></div></div>{store.logs.slice(0, 8).map(log => <div key={log.id}><span className={log.changeQty > 0 ? "in" : "out"}>{log.changeQty > 0 ? "+" : ""}{log.changeQty}</span><p><strong>{log.itemName}</strong><small>{log.notes || "Penyesuaian stok"}</small></p></div>)}{!store.logs.length && <p>Belum ada pergerakan stok.</p>}</section>
    </section>
    <InventoryForm key={edit === "new" ? "new" : edit?.id ?? "closed"} state={edit} close={() => setEdit(null)} save={(value) => {
      const saved = edit === "new" ? store.addItem(value) : edit ? store.editItem(edit.id, value) : false;
      if (saved) setEdit(null);
      report(saved, edit === "new" ? "Barang baru berhasil disimpan." : "Stok fisik berhasil diperbarui.");
      return saved;
    }}/>
  </main>;
}

function InventoryForm({ state, close, save }: { state: EditState; close: () => void; save: (value: Pick<InventoryItem, "name" | "currentStock" | "unit" | "lastCostPrice" | "minStockAlert">) => boolean }) {
  const [error, setError] = useState("");
  if (!state) return null;
  const current = state === "new" ? null : state;
  return <Modal open title={current ? "Edit stok fisik" : "Tambah barang stok"} subtitle="Pastikan satuan dan jumlah sesuai kondisi nyata" onClose={close}><form className="form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const saved = save({ name: String(data.get("name")), currentStock: Number(data.get("stock")), unit: String(data.get("unit")), lastCostPrice: Number(data.get("cost")), minStockAlert: Number(data.get("minimum")) }); if (!saved) setError("Perubahan stok belum dapat disimpan. Periksa data dan penyimpanan perangkat."); }}>{error && <p className="inventory-status" role="alert">{error}</p>}<label className="field"><span>Nama barang</span><input name="name" required defaultValue={current?.name}/></label><label className="field"><span>Jumlah stok fisik</span><input name="stock" required type="number" min="0" max={MAX_STOCK_QUANTITY} step="0.01" defaultValue={current?.currentStock ?? 0}/></label><label className="field"><span>Satuan</span><input name="unit" required defaultValue={current?.unit ?? "pcs"}/></label><label className="field"><span>Harga modal terakhir</span><input name="cost" required type="number" min="0" step="1" defaultValue={current?.lastCostPrice ?? 0}/></label><label className="field"><span>Batas stok minimum</span><input name="minimum" required type="number" min="0" max={MAX_STOCK_QUANTITY} step="0.01" defaultValue={current?.minStockAlert ?? 3}/></label><div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="primary" type="submit">Simpan stok</button></div></form></Modal>;
}
