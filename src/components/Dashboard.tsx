"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, DatabaseBackup, History, ImageUp, Plus, QrCode, Search, Settings2, Trash2, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import Image from "next/image";
import { DEBTS_KEY, useKasbonStore } from "@/hooks/useKasbonStore";
import { formatDate, formatIDR, isValidWhatsAppNumber, parseIDRInput } from "@/lib/utils";
import { assertValidQrisUpload, calculateCropPreviewGeometry, prepareQrisImage, type QrisCrop } from "@/lib/qris-image";
import { feedback } from "@/lib/feedback";
import { clearFormDraft, DEBT_DRAFT_KEY, readDebtDraft, writeFormDraft, type DebtFormDraft } from "@/lib/form-drafts";
import type { DebtItem } from "@/types";
import type { StockSelection } from "@/types/inventory";
import type { InventoryStore } from "./InventoryDashboard";
import BackupModal from "./BackupModal";
import { DebtCard } from "./DebtCard";
import { Modal } from "./Modal";
import { StockPicker } from "./StockPicker";
import QRISModal from "./QRISModal";

export type KasbonStore = ReturnType<typeof useKasbonStore>;
type ModalState = { kind: "add" | "pay" | "increase" | "settings" | "backup" | "delete"; debt?: DebtItem } | null;

interface DashboardProps {
  store: KasbonStore;
  todayTurnover?: number;
  debtPrefill?: number | null;
  debtStockPrefill?: StockSelection[];
  inventoryStore?: InventoryStore;
  onDebtPrefillConsumed?: () => void;
}

export default function Dashboard() {
  const store = useKasbonStore();
  return <DashboardView store={store}/>;
}

export function DashboardView({ store, todayTurnover = 0, debtPrefill, debtStockPrefill = [], inventoryStore, onDebtPrefillConsumed }: DashboardProps) {
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
      <div className="hero-finance-summary">
        <div className="daily-turnover-card">
          <div><span>Omzet hari ini</span><small>Uang masuk dari penjualan</small></div>
          <TrendingUp size={20}/>
          <strong>{formatIDR(todayTurnover)}</strong>
        </div>
        <div className="receivable-summary">
          <div><span>Total piutang aktif</span><p><UsersRound size={14}/>{store.active.length} pelanggan masih memiliki kasbon</p></div>
          <strong>{formatIDR(store.totalReceivable)}</strong>
        </div>
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

    <FormModal key={`${effectiveModal?.kind ?? "closed"}:${effectiveModal?.debt?.id ?? "new"}`} state={effectiveModal} close={closeModal} store={store} openBackup={() => setModal({ kind: "backup" })} selectExisting={debt => { clearFormDraft(DEBT_DRAFT_KEY); setModal({ kind: "increase", debt }); }} debtPrefill={debtPrefill} debtStockPrefill={debtStockPrefill} inventoryStore={inventoryStore}/>
    <DeleteDebtModal state={effectiveModal} close={closeModal} store={store} error={deleteError} setError={setDeleteError}/>
    <BackupModal open={effectiveModal?.kind === "backup"} onClose={() => setModal(null)} storeProfile={store.store} debts={store.debts} onRestored={() => window.location.reload()}/>
  </main>;
}

function FormModal({ state, close, store, openBackup, selectExisting, debtPrefill, debtStockPrefill, inventoryStore }: {
  state: ModalState;
  close: () => void;
  store: KasbonStore;
  openBackup: () => void;
  selectExisting: (debt: DebtItem) => void;
  debtPrefill?: number | null;
  debtStockPrefill: StockSelection[];
  inventoryStore?: InventoryStore;
}) {
  const [saveError, setSaveError] = useState("");
  const [stockItems, setStockItems] = useState<StockSelection[]>(state?.kind === "add" ? debtStockPrefill : []);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [qrisOpen, setQrisOpen] = useState(false);
  const [qrisImage, setQrisImage] = useState(store.store.qrisImageBase64 ?? "");
  const [qrisUploadError, setQrisUploadError] = useState("");
  const [qrisProcessing, setQrisProcessing] = useState(false);
  const [qrisCropFile, setQrisCropFile] = useState<File | null>(null);
  const [qrisCropPreview, setQrisCropPreview] = useState("");
  const [qrisCrop, setQrisCrop] = useState<QrisCrop>({ zoom: 1, x: 0, y: 0 });
  const [qrisImageSize, setQrisImageSize] = useState({ width: 0, height: 0 });
  const [debtDraft, setDebtDraft] = useState<DebtFormDraft>(() => readDebtDraft() ?? {
    name: "", phone: "", items: "", amount: debtPrefill ? String(debtPrefill) : "", due: "",
  });
  const existingCustomers = useMemo(() => {
    const sorted = [...store.debts].sort((left, right) => {
      const statusOrder = Number(left.status === "PAID") - Number(right.status === "PAID");
      return statusOrder || right.createdAt.localeCompare(left.createdAt);
    });
    const unique = new Map<string, DebtItem>();
    for (const debt of sorted) {
      const key = debt.phoneNumber.replace(/\D/g, "") || debt.customerName.trim().toLocaleLowerCase("id-ID");
      if (!unique.has(key)) unique.set(key, debt);
    }
    return [...unique.values()];
  }, [store.debts]);
  useEffect(() => {
    if (state?.kind === "add") writeFormDraft(DEBT_DRAFT_KEY, debtDraft);
  }, [debtDraft, state?.kind]);
  useEffect(() => () => { if (qrisCropPreview) URL.revokeObjectURL(qrisCropPreview); }, [qrisCropPreview]);
  const qrisPreviewGeometry = qrisImageSize.width && qrisImageSize.height
    ? calculateCropPreviewGeometry(qrisImageSize.width, qrisImageSize.height, qrisCrop)
    : null;
  const qrisPreviewStyle = qrisPreviewGeometry ? {
    width: `${qrisPreviewGeometry.widthPercent}%`,
    height: `${qrisPreviewGeometry.heightPercent}%`,
    left: `${qrisPreviewGeometry.leftPercent}%`,
    top: `${qrisPreviewGeometry.topPercent}%`,
  } : undefined;
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
    const payment = state.kind === "pay" ? parseIDRInput(String(form.get("amount"))) : 0;
    if (state.kind === "pay" && state.debt) saved = store.payDebt(state.debt.id, payment);
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
      qrisImageBase64: qrisImage || undefined,
    });
    if (!saved) {
      setSaveError("Kasbon dan stok belum dapat disimpan. Periksa jumlah stok, data barang, dan penyimpanan perangkat.");
      return;
    }
    setSaveError("");
    if (state.kind === "add") clearFormDraft(DEBT_DRAFT_KEY);
    if (state.kind === "pay" && state.debt && payment === state.debt.remainingAmount) feedback.playKaching();
    close();
  };
  const titles = { add: "Catat kasbon baru", pay: "Catat pembayaran", increase: "Tambah kasbon", settings: "Pengaturan warung" };
  const subtitle = state.debt ? state.debt.customerName : state.kind === "add" ? "Isi data pelanggan dan belanjaannya" : "Perbarui identitas dan info pembayaran";
  const qrisAmount = parseIDRInput(paymentAmount);
  return <><Modal open={!qrisOpen} title={titles[state.kind]} subtitle={subtitle} onClose={close}>
    <form onSubmit={submit} className="form">
      {state.kind === "add" && <>
        {existingCustomers.length > 0 && <div className="existing-customer-panel"><span>Pelanggan Kasbon tersimpan</span><small>Pilih pelanggan agar pembelian ditambahkan ke profil dan riwayat yang sama.</small><div>{existingCustomers.map(debt => <button type="button" key={debt.id} onClick={() => selectExisting(debt)}><strong>{debt.customerName}</strong><span>{debt.phoneNumber} · {debt.status === "PAID" ? "Riwayat lunas" : `Sisa ${formatIDR(debt.remainingAmount)}`}</span><b>Pilih {debt.customerName}</b></button>)}</div></div>}
        <Field name="name" label="Nama pelanggan" placeholder="Contoh: Ibu Siti" value={debtDraft.name} onChange={event => setDebtDraft({...debtDraft, name:event.target.value})}/>
        <Field name="phone" label="Nomor WhatsApp" type="tel" inputMode="tel" pattern="(?:[+]62|62|0)(?: |-)*8(?:(?: |-)*[0-9]){8,11}(?: |-)*" title="Gunakan nomor Indonesia aktif, contoh 081234567890" placeholder="08xxxxxxxxxx" value={debtDraft.phone} onChange={event => setDebtDraft({...debtDraft, phone:event.target.value})}/>
        <Field name="items" label="Barang yang diambil" placeholder="Contoh: Beras 5 kg, minyak 2 L" value={debtDraft.items} onChange={event => setDebtDraft({...debtDraft, items:event.target.value})}/>
        {inventoryStore && <StockPicker inventory={inventoryStore.inventory} value={stockItems} onChange={setStockItems}/>}
        <Field name="amount" label="Total kasbon" type="number" inputMode="numeric" min={1} step={1} value={debtDraft.amount} onChange={event => setDebtDraft({...debtDraft, amount:event.target.value})} placeholder="Rp 0"/>
        <Field name="due" label="Jatuh tempo (opsional)" type="date" value={debtDraft.due} onChange={event => setDebtDraft({...debtDraft, due:event.target.value})}/>
      </>}
      {state.kind === "pay" && <><div className="balance-note"><span>Sisa kasbon</span><strong>{formatIDR(state.debt?.remainingAmount ?? 0)}</strong></div><Field name="amount" label="Jumlah pembayaran" type="number" inputMode="numeric" min={1} max={state.debt?.remainingAmount} step={1} value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)}/><button className="qris-trigger" type="button" disabled={!qrisAmount || qrisAmount > (state.debt?.remainingAmount ?? 0)} onClick={() => setQrisOpen(true)}><QrCode size={18}/> Bayar via QRIS</button></>}
      {state.kind === "increase" && <><Field name="items" label="Barang tambahan"/>{inventoryStore && <StockPicker inventory={inventoryStore.inventory} value={stockItems} onChange={setStockItems}/>}<Field name="amount" label="Nominal tambahan" type="number" inputMode="numeric" min={1} step={1}/></>}
      {state.kind === "settings" && <>
        <Field name="storeName" label="Nama warung" defaultValue={store.store.storeName}/>
        <Field name="ownerName" label="Nama pemilik" defaultValue={store.store.ownerName}/>
        <Field name="paymentInfo" label="Info pembayaran (opsional)" defaultValue={store.store.paymentInfo}/>
        <div className="qris-upload-field">
          <span>Foto QRIS warung (opsional)</span>
          {qrisImage && <div className="qris-upload-preview"><Image unoptimized src={qrisImage} width={64} height={64} alt="Pratinjau QRIS"/><button type="button" onClick={() => { setQrisImage(""); setQrisUploadError(""); }}><Trash2 size={16}/> Hapus</button></div>}
          <label className="qris-upload-button"><ImageUp size={18}/><span>{qrisImage ? "Ganti foto QRIS" : "Unggah foto QRIS"}</span><input aria-label="Unggah foto QRIS" type="file" accept="image/png,image/jpeg,image/webp" disabled={qrisProcessing} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setQrisUploadError("");
            try {
              assertValidQrisUpload(file);
              setQrisCropFile(file);
              setQrisCropPreview(URL.createObjectURL(file));
              setQrisCrop({ zoom: 1, x: 0, y: 0 });
              setQrisImageSize({ width: 0, height: 0 });
            }
            catch (error) { setQrisUploadError(error instanceof Error ? error.message : "Gambar QRIS belum dapat diproses."); }
          }}/></label>
          {qrisCropFile && qrisCropPreview && <div className="qris-crop-editor" aria-label="Atur crop QRIS">
            <div className="qris-crop-viewport"><Image unoptimized src={qrisCropPreview} alt="Pratinjau crop QRIS" width={1} height={1} onLoad={event => setQrisImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={qrisPreviewStyle}/><span aria-hidden="true"/></div>
            <label><span>Perbesar</span><input aria-label="Perbesar crop QRIS" type="range" min="1" max="3" step="0.1" value={qrisCrop.zoom} onChange={event => setQrisCrop({...qrisCrop, zoom:Number(event.target.value)})}/></label>
            <div className="qris-crop-position"><label><span>Geser horizontal</span><input aria-label="Geser crop horizontal" type="range" min="-1" max="1" step="0.05" value={qrisCrop.x} onChange={event => setQrisCrop({...qrisCrop, x:Number(event.target.value)})}/></label><label><span>Geser vertikal</span><input aria-label="Geser crop vertikal" type="range" min="-1" max="1" step="0.05" value={qrisCrop.y} onChange={event => setQrisCrop({...qrisCrop, y:Number(event.target.value)})}/></label></div>
            <div className="qris-crop-actions"><button type="button" onClick={() => { setQrisCropFile(null); setQrisCropPreview(""); setQrisImageSize({ width: 0, height: 0 }); }}>Batal crop</button><button className="primary" type="button" disabled={qrisProcessing} onClick={async () => {
              setQrisProcessing(true); setQrisUploadError("");
              try { setQrisImage(await prepareQrisImage(qrisCropFile, qrisCrop)); setQrisCropFile(null); setQrisCropPreview(""); setQrisImageSize({ width: 0, height: 0 }); }
              catch (error) { setQrisUploadError(error instanceof Error ? error.message : "Gambar QRIS belum dapat diproses."); }
              finally { setQrisProcessing(false); }
            }}>{qrisProcessing ? "Memproses…" : "Gunakan hasil crop"}</button></div>
          </div>}
          <small>PNG, JPEG, atau WebP. Atur area QR agar rapi, lalu simpan hasil crop.</small>
          {qrisUploadError && <p className="delete-error" role="alert">{qrisUploadError}</p>}
        </div>
        <button type="button" className="data-center-entry" onClick={openBackup}><DatabaseBackup size={20}/><span><strong>Pusat Data & Cadangan</strong><small>Export rekap, backup, atau pulihkan data</small></span></button>
      </>}
      {saveError && <p className="delete-error" role="alert">{saveError}</p>}
      <div className="form-actions"><button type="button" onClick={() => { if (state.kind === "add") clearFormDraft(DEBT_DRAFT_KEY); close(); }}>Batal</button><button className="primary form-submit" type="submit" disabled={qrisProcessing}>Simpan catatan</button></div>
    </form>
  </Modal><QRISModal open={qrisOpen} onClose={() => setQrisOpen(false)} store={store.store} amount={qrisAmount}/></>;
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
