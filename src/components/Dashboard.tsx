"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, DatabaseBackup, History, Plus, Search, Settings2, UsersRound, WalletCards } from "lucide-react";
import { DEBTS_KEY, useKasbonStore } from "@/hooks/useKasbonStore";
import { formatDate, formatIDR, isValidWhatsAppNumber, parseIDRInput } from "@/lib/utils";
import type { DebtItem } from "@/types";
import type { StockSelection } from "@/types/inventory";
import type { InventoryStore } from "./InventoryDashboard";
import BackupModal from "./BackupModal";
import { DebtCard } from "./DebtCard";
import { Modal } from "./Modal";
import { StockPicker } from "./StockPicker";

export type KasbonStore = ReturnType<typeof useKasbonStore>;
type ModalState = { kind: "add" | "pay" | "increase" | "settings" | "backup" | "delete"; debt?: DebtItem } | null;

interface DashboardProps {
  store: KasbonStore;
  debtPrefill?: number | null;
  debtStockPrefill?: StockSelection[];
  inventoryStore?: InventoryStore;
  onDebtPrefillConsumed?: () => void;
}

export default function Dashboard() {
  const store = useKasbonStore();
  return <DashboardView store={store}/>;
}

export function DashboardView({ store, debtPrefill, debtStockPrefill = [], inventoryStore, onDebtPrefillConsumed }: DashboardProps) {
  const [tab, setTab] = useState<"active" | "paid">("active");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteError, setDeleteError] = useState("");
  const list = tab === "active" ? store.active : store.paid;
  const filtered = useMemo(() => list.filter(debt =>
    (debt.customerName + debt.phoneNumber + debt.itemsDescription).toLowerCase().includes(search.toLowerCase()),
  ), [list, search]);

  const effectiveModal: ModalState = modal ?? (debtPrefill && debtPrefill > 0 ? { kind: "add" } : null);

  const closeModal = () => {
    if (effectiveModal?.kind === "add" && debtPrefill) onDebtPrefillConsumed?.();
    setModal(null);
  };

  if (!store.hydrated) return <main className="app-shell loading">Membuka buku kasbon…</main>;

  return <main className="app-shell">
    <section className="hero">
      <div className="brand-row">
        <div className="brand-mark"><BookOpenCheck size={22}/></div>
        <div><span>BUKU KASBON DIGITAL</span><h1>{store.store.storeName}</h1><p>{store.store.ownerName}</p></div>
        <button className="settings" onClick={() => setModal({ kind: "settings" })} aria-label="Pengaturan warung"><Settings2 size={19}/></button>
      </div>
      <div className="total-label">
        <span>Total piutang aktif</span><strong>{formatIDR(store.totalReceivable)}</strong>
        <p><UsersRound size={15}/>{store.active.length} pelanggan masih memiliki kasbon</p>
      </div>
    </section>

    <section className="content">
      <div className="action-heading"><div><p>Ringkasan kasbon pelanggan</p><h2>Kelola kasbon dengan mudah</h2></div><button className="primary" onClick={() => setModal({ kind: "add" })}><Plus size={19}/> Catat kasbon</button></div>
      <label className="search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, nomor HP, atau barang…"/></label>
      <nav className="tabs">
        <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}><WalletCards size={17}/>Kasbon Aktif <b>{store.active.length}</b></button>
        <button className={tab === "paid" ? "active" : ""} onClick={() => setTab("paid")}><History size={17}/>Riwayat Lunas</button>
      </nav>
      <div className="list-head"><h2>{tab === "active" ? "Daftar kasbon" : "Riwayat pelunasan"}</h2><span>{filtered.length} catatan</span></div>
      {filtered.length ? <div className="debt-list">{filtered.map(debt => tab === "active"
        ? <DebtCard key={debt.id} debt={debt} store={store.store} onAdd={() => setModal({ kind: "increase", debt })} onPay={() => setModal({ kind: "pay", debt })} onDelete={() => { setDeleteError(""); setModal({ kind: "delete", debt }); }}/>
        : <article className="history-card" key={debt.id}><div className="paid-icon"><CheckCircle2/></div><div><h3>{debt.customerName}</h3><p>{debt.itemsDescription}</p><span>Lunas · {formatDate(debt.paymentHistory.at(-1)?.paidAt ?? debt.createdAt)}</span></div><strong>{formatIDR(debt.totalAmount)}</strong></article>,
      )}</div> : <div className="empty"><div><BookOpenCheck size={26}/></div><h3>{tab === "active" ? "Belum ada kasbon aktif" : "Belum ada riwayat lunas"}</h3><p>{tab === "active" ? "Mulai catat kasbon pelanggan pertama Anda." : "Kasbon yang lunas akan tampil di sini."}</p>{tab === "active" && <button className="primary" onClick={() => setModal({ kind: "add" })}>Catat kasbon</button>}</div>}
    </section>
    <footer>Data tersimpan otomatis di perangkat ini · Gunakan cadangan saat pindah HP</footer>

    <FormModal key={`${effectiveModal?.kind ?? "closed"}:${effectiveModal?.debt?.id ?? "new"}`} state={effectiveModal} close={closeModal} store={store} openBackup={() => setModal({ kind: "backup" })} debtPrefill={debtPrefill} debtStockPrefill={debtStockPrefill} inventoryStore={inventoryStore}/>
    <DeleteDebtModal state={effectiveModal} close={closeModal} store={store} error={deleteError} setError={setDeleteError}/>
    <BackupModal open={effectiveModal?.kind === "backup"} onClose={() => setModal(null)} storeProfile={store.store} debts={store.debts} onRestored={() => window.location.reload()}/>
  </main>;
}

function FormModal({ state, close, store, openBackup, debtPrefill, debtStockPrefill, inventoryStore }: {
  state: ModalState;
  close: () => void;
  store: KasbonStore;
  openBackup: () => void;
  debtPrefill?: number | null;
  debtStockPrefill: StockSelection[];
  inventoryStore?: InventoryStore;
}) {
  const [saveError, setSaveError] = useState("");
  const [stockItems, setStockItems] = useState<StockSelection[]>(state?.kind === "add" ? debtStockPrefill : []);
  if (!state || state.kind === "backup" || state.kind === "delete") return null;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let saved = false;
    if (state.kind === "add") {
      const phone = String(form.get("phone"));
      if (!isValidWhatsAppNumber(phone)) return;
      const input = {
        customerName: String(form.get("name")),
        phoneNumber: phone,
        itemsDescription: String(form.get("items")),
        totalAmount: parseIDRInput(String(form.get("amount"))),
        dueDate: String(form.get("due")) || undefined,
      };
      if (stockItems.length && inventoryStore && store.canMutate()) {
        try {
          const prepared = store.prepareDebt(input);
          saved = inventoryStore.deductSale(stockItems, "OUT_DEBT", `Kasbon ${input.customerName}`, prepared.debt.id, new Map([[DEBTS_KEY, JSON.stringify(prepared.debts)]]));
          if (saved) store.acceptCommittedDebts(prepared.debts);
        } catch { saved = false; }
      } else saved = store.addDebt(input);
    }
    if (state.kind === "pay" && state.debt) saved = store.payDebt(state.debt.id, parseIDRInput(String(form.get("amount"))));
    if (state.kind === "increase" && state.debt) {
      const amount = parseIDRInput(String(form.get("amount")));
      const description = String(form.get("items"));
      if (stockItems.length && inventoryStore && store.canMutate()) {
        try {
          const nextDebts = store.prepareDebtIncrease(state.debt.id, amount, description);
          saved = inventoryStore.deductSale(stockItems, "OUT_DEBT", `Tambahan kasbon ${state.debt.customerName}`, `debt-increase-${crypto.randomUUID()}`, new Map([[DEBTS_KEY, JSON.stringify(nextDebts)]]));
          if (saved) store.acceptCommittedDebts(nextDebts);
        } catch { saved = false; }
      } else saved = store.addToDebt(state.debt.id, amount, description);
    }
    if (state.kind === "settings") saved = store.setStore({
      storeName: String(form.get("storeName")),
      ownerName: String(form.get("ownerName")),
      paymentInfo: String(form.get("paymentInfo")),
    });
    if (!saved) {
      setSaveError("Kasbon dan stok belum dapat disimpan. Periksa jumlah stok, data barang, dan penyimpanan perangkat.");
      return;
    }
    setSaveError("");
    close();
  };
  const titles = { add: "Catat kasbon baru", pay: "Catat pembayaran", increase: "Tambah kasbon", settings: "Pengaturan warung" };
  const subtitle = state.debt ? state.debt.customerName : state.kind === "add" ? "Isi data pelanggan dan belanjaannya" : "Perbarui identitas dan info pembayaran";
  return <Modal open title={titles[state.kind]} subtitle={subtitle} onClose={close}>
    <form onSubmit={submit} className="form">
      {state.kind === "add" && <>
        <Field name="name" label="Nama pelanggan" placeholder="Contoh: Ibu Siti"/>
        <Field name="phone" label="Nomor WhatsApp" type="tel" inputMode="tel" pattern="(?:[+]62|62|0)(?: |-)*8(?:(?: |-)*[0-9]){8,11}(?: |-)*" title="Gunakan nomor Indonesia aktif, contoh 081234567890" placeholder="08xxxxxxxxxx"/>
        <Field name="items" label="Barang yang diambil" placeholder="Contoh: Beras 5 kg, minyak 2 L"/>
        {inventoryStore && <StockPicker inventory={inventoryStore.inventory} value={stockItems} onChange={setStockItems}/>}
        <Field name="amount" label="Total kasbon" type="number" inputMode="numeric" min={1} step={1} defaultValue={debtPrefill ?? undefined} placeholder="Rp 0"/>
        <Field name="due" label="Jatuh tempo (opsional)" type="date"/>
      </>}
      {state.kind === "pay" && <><div className="balance-note"><span>Sisa kasbon</span><strong>{formatIDR(state.debt?.remainingAmount ?? 0)}</strong></div><Field name="amount" label="Jumlah pembayaran" type="number" inputMode="numeric" min={1} max={state.debt?.remainingAmount} step={1}/></>}
      {state.kind === "increase" && <><Field name="items" label="Barang tambahan"/>{inventoryStore && <StockPicker inventory={inventoryStore.inventory} value={stockItems} onChange={setStockItems}/>}<Field name="amount" label="Nominal tambahan" type="number" inputMode="numeric" min={1} step={1}/></>}
      {state.kind === "settings" && <>
        <Field name="storeName" label="Nama warung" defaultValue={store.store.storeName}/>
        <Field name="ownerName" label="Nama pemilik" defaultValue={store.store.ownerName}/>
        <Field name="paymentInfo" label="Info pembayaran (opsional)" defaultValue={store.store.paymentInfo}/>
        <button type="button" className="data-center-entry" onClick={openBackup}><DatabaseBackup size={20}/><span><strong>Pusat Data & Cadangan</strong><small>Export rekap, backup, atau pulihkan data</small></span></button>
      </>}
      {saveError && <p className="delete-error" role="alert">{saveError}</p>}
      <div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="primary form-submit" type="submit">Simpan catatan</button></div>
    </form>
  </Modal>;
}

function DeleteDebtModal({ state, close, store, error, setError }: {
  state: ModalState;
  close: () => void;
  store: KasbonStore;
  error: string;
  setError: (value: string) => void;
}) {
  if (state?.kind !== "delete" || !state.debt) return null;
  const debt = state.debt;
  const confirmDelete = () => {
    if (!store.deleteDebt(debt.id)) {
      setError("Kasbon belum dapat dihapus. Data tetap tersimpan; periksa ruang penyimpanan perangkat.");
      return;
    }
    close();
  };
  return <Modal open title="Hapus kasbon?" subtitle="Tindakan ini tidak dapat dibatalkan" onClose={close}>
    <div className="delete-confirmation">
      <p>Hapus kasbon {debt.customerName} sebesar {formatIDR(debt.remainingAmount)}?</p>
      <small>Riwayat kasbon dan pembayaran pelanggan ini akan dihapus permanen dari perangkat.</small>
      {error && <div className="delete-error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" onClick={close}>Batal</button><button className="delete-confirm" type="button" onClick={confirmDelete}>Ya, hapus kasbon</button></div>
    </div>
  </Modal>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return <label className="field"><span>{label}</span><input required={rest.name !== "due" && rest.name !== "paymentInfo"} {...rest}/></label>;
}
