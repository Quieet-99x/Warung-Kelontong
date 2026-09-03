"use client";

import { AlertTriangle, Check, ClipboardList, History, Package, PackagePlus, Pencil, Plus, ScanBarcode, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { useInventoryStore } from "@/hooks/useInventoryStore";
import { findInventoryByBarcode } from "@/lib/inventory-barcode";
import { searchItemNames } from "@/lib/item-search";
import { MAX_STOCK_QUANTITY } from "@/lib/inventory-storage";
import type { InventoryItem, WholesaleUnitName } from "@/types/inventory";
import { BarcodeScanner } from "./BarcodeScanner";
import { Modal } from "./Modal";

export type InventoryStore = ReturnType<typeof useInventoryStore>;
type EditState = InventoryItem | "new" | null;

export default function InventoryDashboard({ store }: { store: InventoryStore }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [edit, setEdit] = useState<EditState>(null);
  const [shoppingDelete, setShoppingDelete] = useState<{ id: string; itemName: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [status, setStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const searchResult = useMemo(() => searchItemNames(store.inventory, search), [search, store.inventory]);
  const list = useMemo(() => searchResult.matches.filter(item => filter === "all" || item.currentStock <= item.minStockAlert), [filter, searchResult.matches]);

  const report = (saved: boolean, success: string) => setStatus(saved ? success : "Perubahan stok belum dapat disimpan di perangkat.");
  if (!store.hydrated) return <main className="inventory-page loading">Membuka data stok…</main>;

  return <main className="inventory-page">
    <section className="inventory-hero"><div className="eyebrow"><Package size={14}/> INVENTORI WARUNG</div><h1>Manajemen stok</h1><p>Pantau jumlah barang, stok menipis, dan kebutuhan restock dari satu tempat.</p><div className="inventory-stats"><span><strong>{store.inventory.length}</strong> barang</span><span className={store.lowStock.length ? "warning" : ""}><strong>{store.lowStock.length}</strong> menipis</span></div></section>
    <section className="inventory-content">
      {store.storageIssue && <p className="inventory-status" role="alert">{store.storageIssue}</p>}
      {status && <p className="inventory-status" role="status">{status}</p>}
      <div className="inventory-tools"><label><Search size={18}/><input type="search" aria-label="Cari nama barang" placeholder="Cari beberapa kata nama barang…" value={search} onChange={event => setSearch(event.target.value)}/></label><button type="button" onClick={() => setEdit("new")}><Plus size={18}/> Barang</button></div>
      {search.trim() && !list.length && searchResult.suggestions.length > 0 && <div className="search-suggestions"><span>Mungkin yang dimaksud: {searchResult.suggestions.map(item => item.name).join(", ")}</span>{searchResult.suggestions.map(item => <button key={item.id} type="button" onClick={() => setSearch(item.name)}>{item.name}</button>)}</div>}
      <nav className="inventory-filters" aria-label="Filter stok"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Semua <b>{store.inventory.length}</b></button><button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}><AlertTriangle size={15}/> Stok menipis <b>{store.lowStock.length}</b></button></nav>
      <div className="inventory-list">{list.map(item => {
        const low = item.currentStock <= item.minStockAlert;
        return <article className={`inventory-card${low ? " low" : ""}`} key={item.id} aria-label={item.name}>
          <div className="inventory-card-head"><div className="inventory-icon"><Package size={20}/></div><div><h2>{item.name}</h2><p>Batas minimum {item.minStockAlert} {item.unit}</p></div><div className="stock-number" aria-label={`Sisa stok ${item.currentStock} ${item.unit}`}>
            {low && <div className="stock-indicators">
              <span className="stock-warning-icon" role="img" aria-label={`Stok menipis, batas minimum ${item.minStockAlert} ${item.unit}`}><AlertTriangle aria-hidden="true" size={17}/></span>
              <button className="shopping-icon" type="button" aria-label={`Tambah ${item.name} ke checklist belanja`} onClick={() => report(store.addToShoppingList(item.id), `${item.name} ditambahkan ke checklist belanja.`)}><ShoppingCart aria-hidden="true" size={17}/></button>
            </div>}
            <strong>{item.currentStock}</strong><small>{item.unit}</small>
          </div></div>
          <div className="inventory-actions"><button onClick={() => report(store.adjustStock(item.id, -1, "Penyesuaian cepat -1"), `Stok ${item.name} dikurangi 1.`)} disabled={item.currentStock < 1}>-1</button><button onClick={() => report(store.adjustStock(item.id, 1, "Penyesuaian cepat +1"), `Stok ${item.name} ditambah 1.`)}>+1</button><button onClick={() => setEdit(item)}><Pencil size={15}/> Edit stok</button></div>
        </article>;
      })}{!list.length && <div className="inventory-empty"><PackagePlus size={30}/><h2>{filter === "low" ? "Tidak ada stok menipis" : "Belum ada barang"}</h2><p>{filter === "low" ? "Semua stok berada di atas batas minimum." : "Scan barcode kemasan atau tambahkan barang secara manual."}</p></div>}</div>
      <section className="shopping-panel"><div className="inventory-section-title"><ClipboardList size={19}/><div><span>CHECKLIST BELANJA</span><h2>Belanja pasar berikutnya</h2></div></div>{store.shoppingList.length ? store.shoppingList.map(item => <div className={`shopping-row${item.checked ? " checked" : ""}`} key={item.id}><label><input type="checkbox" checked={item.checked} onChange={() => report(store.toggleShoppingItem(item.id), "Checklist belanja diperbarui.")}/><Check size={15}/><span>{item.itemName}</span></label><button className="shopping-delete" type="button" aria-label={`Hapus ${item.itemName} dari checklist belanja`} onClick={() => { setDeleteError(""); setShoppingDelete({ id: item.id, itemName: item.itemName }); }}><Trash2 aria-hidden="true" size={17}/></button></div>) : <p>Barang menipis yang ditambahkan akan muncul di sini.</p>}</section>
      <section className="inventory-log"><div className="inventory-section-title"><History size={19}/><div><span>AKTIVITAS TERBARU</span><h2>Pergerakan stok</h2></div></div>{store.logs.slice(0, 8).map(log => <div key={log.id}><span className={log.changeQty > 0 ? "in" : "out"}>{log.changeQty > 0 ? "+" : ""}{log.changeQty}</span><p><strong>{log.itemName}</strong><small>{log.notes || "Penyesuaian stok"}</small></p></div>)}{!store.logs.length && <p>Belum ada pergerakan stok.</p>}</section>
    </section>
    <button className="module-scan-fab" type="button" aria-label="Scan barcode stok" onClick={() => setScannerOpen(true)}><ScanBarcode aria-hidden="true"/></button>
    <InventoryForm key={edit === "new" ? "new" : edit?.id ?? "closed"} state={edit} close={() => setEdit(null)} save={(value) => {
      const saved = edit === "new" ? store.addItem(value) : edit ? store.editItem(edit.id, value) : false;
      if (saved) setEdit(null);
      report(saved, edit === "new" ? "Barang baru berhasil disimpan." : "Stok fisik berhasil diperbarui.");
      return saved;
    }}/>
    <BarcodeScanner open={scannerOpen} title="Scan barcode stok" onClose={() => setScannerOpen(false)} onDetected={barcode => { setScannerOpen(false); setScannedBarcode(barcode); }}/>
    <StockBarcodeIntake key={`barcode-${scannedBarcode || "closed"}`} barcode={scannedBarcode} inventory={store.inventory} close={() => setScannedBarcode("")} adjust={(itemId, quantity, notes) => {
      const saved = store.adjustStock(itemId, quantity, notes);
      report(saved, "Stok dari barcode berhasil ditambahkan.");
      if (saved) setScannedBarcode("");
      return saved;
    }} add={value => {
      const saved = store.addItem(value);
      report(saved, "Barang baru dan stok awal berhasil disimpan.");
      if (saved) setScannedBarcode("");
      return saved;
    }}/>
    <Modal open={Boolean(shoppingDelete)} title="Hapus item belanja?" subtitle="Item hanya dihapus dari checklist, bukan dari inventori." onClose={() => { setShoppingDelete(null); setDeleteError(""); }}>
      {shoppingDelete && <div className="shopping-delete-confirmation">{deleteError && <p className="inventory-status" role="alert">{deleteError}</p>}<p><strong>{shoppingDelete.itemName}</strong> akan dihapus dari checklist belanja.</p><div className="form-actions"><button type="button" onClick={() => { setShoppingDelete(null); setDeleteError(""); }}>Batal</button><button className="delete-confirm" type="button" onClick={() => { const removed = store.removeShoppingItem(shoppingDelete.id); if (!removed) { setDeleteError("Item checklist belum dapat dihapus. Periksa penyimpanan perangkat."); return; } setStatus(`${shoppingDelete.itemName} dihapus dari checklist belanja.`); setShoppingDelete(null); setDeleteError(""); }}>Hapus item</button></div></div>}
    </Modal>
  </main>;
}

function InventoryForm({ state, close, save }: { state: EditState; close: () => void; save: (value: Pick<InventoryItem, "name" | "currentStock" | "unit" | "lastCostPrice" | "minStockAlert" | "baseBarcode" | "baseSellPrice" | "alternateUnits">) => boolean }) {
  const [error, setError] = useState("");
  const current = state && state !== "new" ? state : null;
  const [wholesale, setWholesale] = useState(Boolean(current?.alternateUnits?.length));
  if (!state) return null;
  const wholesaleUnit = current?.alternateUnits?.[0];
  return <Modal open title={current ? "Edit stok fisik" : "Tambah barang stok"} subtitle="Semua stok disimpan dalam satuan terkecil" onClose={close}><form className="form inventory-product-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const barcode = String(data.get("baseBarcode")).trim();
    const wholesaleBarcode = String(data.get("wholesaleBarcode") ?? "").trim();
    if (wholesale && barcode && barcode === wholesaleBarcode) { setError("Barcode eceran dan grosir tidak boleh sama."); return; }
    const alternateUnits = wholesale ? [{ id: wholesaleUnit?.id ?? crypto.randomUUID(), name: String(data.get("wholesaleName")) as "Dus" | "Renceng" | "Pak" | "Bal", barcode: wholesaleBarcode, conversion: Number(data.get("conversion")), lastCostPrice: 0, sellPrice: 0 }] : [];
    const saved = save({ name: String(data.get("name")), currentStock: Number(data.get("stock")), unit: String(data.get("unit")), lastCostPrice: current?.lastCostPrice ?? 0, minStockAlert: Number(data.get("minimum")), baseBarcode: barcode || undefined, baseSellPrice: current?.baseSellPrice ?? 0, alternateUnits });
    if (!saved) setError("Perubahan stok belum dapat disimpan. Periksa barcode, data, dan penyimpanan perangkat.");
  }}>
    {error && <p className="inventory-status" role="alert">{error}</p>}
    <label className="field"><span>Nama barang</span><input name="name" required defaultValue={current?.name}/></label>
    <div className="inventory-form-grid"><label className="field"><span>Jumlah stok fisik</span><input name="stock" required type="number" min="0" max={MAX_STOCK_QUANTITY} step="0.01" defaultValue={current?.currentStock ?? 0}/></label><label className="field"><span>Satuan terkecil</span><input name="unit" required defaultValue={current?.unit ?? "pcs"}/></label></div>
    <label className="field"><span>Batas stok minimum</span><input name="minimum" required type="number" min="0" max={MAX_STOCK_QUANTITY} step="0.01" defaultValue={current?.minStockAlert ?? 3}/></label>
    <section className="unit-mapping-panel"><strong>Satuan eceran</strong><label className="field"><span>Barcode eceran</span><input name="baseBarcode" defaultValue={current?.baseBarcode}/></label></section>
    <label className="wholesale-toggle"><input type="checkbox" checked={wholesale} onChange={event => setWholesale(event.target.checked)}/><span>Punya satuan grosir/dus?</span></label>
    {wholesale && <section className="unit-mapping-panel wholesale"><strong>Satuan grosir</strong><div className="inventory-form-grid"><label className="field"><span>Jenis satuan</span><select name="wholesaleName" defaultValue={wholesaleUnit?.name ?? "Dus"}><option>Dus</option><option>Renceng</option><option>Pak</option><option>Bal</option></select></label><label className="field"><span>Isi per kemasan</span><input aria-label="Isi per kemasan" name="conversion" required type="number" min="2" step="1" defaultValue={wholesaleUnit?.conversion}/></label></div><label className="field"><span>Barcode grosir</span><input name="wholesaleBarcode" required defaultValue={wholesaleUnit?.barcode}/></label></section>}
    <div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="primary" type="submit">Simpan stok</button></div>
  </form></Modal>;
}

function StockBarcodeIntake({ barcode, inventory, close, adjust, add }: { barcode: string; inventory: InventoryItem[]; close: () => void; adjust: (itemId: string, quantity: number, notes: string) => boolean; add: (value: Pick<InventoryItem, "name" | "currentStock" | "unit" | "lastCostPrice" | "minStockAlert" | "baseBarcode" | "baseSellPrice" | "alternateUnits">) => boolean }) {
  const resolved = useMemo(() => findInventoryByBarcode(inventory, barcode), [barcode, inventory]);
  const [error, setError] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(resolved?.item.id ?? "");
  const selectedItem = inventory.find(item => item.id === selectedItemId) ?? resolved?.item;
  if (!barcode) return null;
  return <Modal open title={resolved ? "Barcode terdaftar" : "Barcode belum terdaftar"} subtitle="Lengkapi informasi stok setelah scan" onClose={close}>
    <div className="scanned-barcode-info"><span>BARCODE TERBACA</span><strong className="scanned-barcode-value">{barcode}</strong></div>
    {resolved ? <form className="form stock-intake-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const itemId = String(data.get("itemId"));
      const item = inventory.find(candidate => candidate.id === itemId);
      const unitName = String(data.get("unit"));
      const mappedUnit = item ? (item.alternateUnits ?? []).find(candidate => candidate.name === unitName) : undefined;
      const conversion = mappedUnit?.conversion ?? 1;
      const packages = Number(data.get("quantity"));
      if (!item || !Number.isFinite(packages) || packages <= 0 || !adjust(item.id, packages * conversion, `${packages} ${unitName} dari scan barcode ${barcode}`)) setError("Stok belum dapat ditambahkan. Periksa jumlah dan penyimpanan perangkat.");
    }}>
      {error && <p className="inventory-status" role="alert">{error}</p>}
      <label className="field"><span>Pilih barang</span><select aria-label="Pilih barang" name="itemId" value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}>{inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="inventory-form-grid"><label className="field"><span>Jumlah</span><input aria-label="Jumlah masuk" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required/></label><label className="field"><span>Satuan</span><select key={selectedItem?.id} aria-label="Satuan masuk" name="unit" defaultValue={selectedItem?.id === resolved.item.id ? resolved.unit.name : selectedItem?.unit}><option>{selectedItem?.unit}</option>{(selectedItem?.alternateUnits ?? []).map(unit => <option key={unit.id}>{unit.name}</option>)}</select></label></div>
      <div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="primary" type="submit">Tambah ke stok</button></div>
    </form> : <form className="form stock-intake-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const packageQty = Number(data.get("quantity"));
      const conversion = Number(data.get("conversion"));
      const unit = String(data.get("unit"));
      const packageName = String(data.get("packageName")) as WholesaleUnitName;
      const saved = add({ name: String(data.get("name")), currentStock: packageQty * conversion, unit, lastCostPrice: 0, minStockAlert: Number(data.get("minimum")), baseSellPrice: 0, alternateUnits: [{ id: crypto.randomUUID(), name: packageName, barcode, conversion, lastCostPrice: 0, sellPrice: 0 }] });
      if (!saved) setError("Barang belum dapat disimpan. Periksa nama, jumlah, barcode, dan batas minimum.");
    }}>
      {error && <p className="inventory-status" role="alert">{error}</p>}
      <label className="field"><span>Nama barang</span><input aria-label="Nama barang baru" name="name" required placeholder="Contoh: Superstar 20g"/></label>
      <div className="inventory-form-grid"><label className="field"><span>Jumlah kemasan</span><input aria-label="Jumlah kemasan" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required/></label><label className="field"><span>Jenis kemasan</span><select aria-label="Jenis kemasan" name="packageName"><option>Dus</option><option>Renceng</option><option>Pak</option><option>Bal</option></select></label></div>
      <div className="inventory-form-grid"><label className="field"><span>Isi per kemasan</span><input aria-label="Isi per kemasan" name="conversion" type="number" min="2" step="1" required/></label><label className="field"><span>Satuan dasar</span><input aria-label="Satuan dasar" name="unit" defaultValue="pcs" required/></label></div>
      <label className="field"><span>Batas stok minimum</span><input aria-label="Batas stok minimum" name="minimum" type="number" min="0" step="0.01" defaultValue="3" required/></label>
      <div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="primary" type="submit">Simpan barang & stok</button></div>
    </form>}
  </Modal>;
}
