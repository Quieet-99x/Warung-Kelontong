"use client";

import imageCompression from "browser-image-compression";
import { feedback } from "@/lib/feedback";
import { Camera, ChevronDown, ChevronRight, FilePenLine, LoaderCircle, MessageCircle, PackageOpen, Plus, ReceiptText, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePurchaseStore } from "@/hooks/usePurchaseStore";
import { createPurchase } from "@/lib/purchase";
import { buildPurchaseWhatsAppUrl } from "@/lib/purchase-whatsapp";

import { formatDate, formatIDR } from "@/lib/utils";
import { clearFormDraft, PURCHASE_DRAFT_KEY, readPurchaseDraft, writeFormDraft } from "@/lib/form-drafts";
import type { ReceiptExtraction, ReceiptItem } from "@/types/receipt";


type Draft = ReceiptExtraction | null;
export type PurchaseStore = ReturnType<typeof usePurchaseStore>;

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Foto gagal dibaca"));
    reader.readAsDataURL(file);
  });
}

export default function KulakanPage() {
  const store = usePurchaseStore();
  return <KulakanPageView store={store}/>;
}

export function KulakanPageView({ store, onSavePurchase }: { store: PurchaseStore; onSavePurchase?: (receipt: ReturnType<typeof createPurchase>) => boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const restored = useMemo(() => readPurchaseDraft(), []);
  const draftIdentityRef = useRef<{ id: string; createdAt: string } | null>(restored?.identity ?? null);
  const [draft, setDraft] = useState<Draft>(restored?.draft ?? null);

  const [loading, setLoading] = useState(false);
  const [scanStage, setScanStage] = useState<"preparing" | "analyzing" | null>(null);
  const [error, setError] = useState("");
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const reviewedTotal = useMemo(() => draft?.items.reduce((total, item) => total + item.qty * item.unitPrice, 0) ?? 0, [draft]);

  useEffect(() => {
    if (!draft) return;
    const identity = draftIdentityRef.current ?? { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    draftIdentityRef.current = identity;
    writeFormDraft(PURCHASE_DRAFT_KEY, { draft, margin: 0, rounding: 500, identity });
  }, [draft]);

  const startManual = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    draftIdentityRef.current = { id: crypto.randomUUID(), createdAt: now.toISOString() };
    setDraft({
      merchantName: "",
      purchaseDate: new Date(now.getTime() - offset).toISOString().slice(0, 10),
      grandTotal: 1,
      items: [{ id: crypto.randomUUID(), itemName: "", qty: 1, unit: "", unitPrice: 1, totalPrice: 1 }],
    });
    setError("");
  };


  const scan = async (file?: File) => {
    if (!file) return;
    setError("");
    setLoading(true);
    setScanStage("preparing");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Pilih file foto struk yang valid.");
      if (file.size > 10_000_000) throw new Error("Ukuran gambar maksimal 10 MB.");
      const compressed = await imageCompression(file, { maxSizeMB: 0.78, maxWidthOrHeight: 1800, useWebWorker: true, fileType: "image/jpeg" });
      const image = await fileToDataUrl(compressed);
      setScanStage("analyzing");
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const payload: { receipt?: ReceiptExtraction; error?: string } = await response.json();
      if (!response.ok || !payload.receipt) throw new Error(payload.error || "Struk belum berhasil dibaca. Coba foto ulang dengan pencahayaan yang lebih jelas.");
      draftIdentityRef.current = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      setDraft(payload.receipt);
      feedback.playBeep();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Foto struk belum berhasil diproses. Silakan coba lagi.");
    } finally {
      setLoading(false);
      setScanStage(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateItem = (id: string, patch: Partial<ReceiptItem>) => {
    setDraft(current => current ? { ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) } : current);
  };

  const save = () => {
    if (!draft) return;
    try {
      const identity = draftIdentityRef.current ?? { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      draftIdentityRef.current = identity;
      const receipt = createPurchase(draft, 0, 500, identity.id, identity.createdAt);
      if (!(onSavePurchase ?? store.savePurchase)(receipt)) throw new Error("Rekap kulakan belum dapat disimpan. Periksa data dan penyimpanan perangkat.");
      setDraft(null);
      draftIdentityRef.current = null;
      clearFormDraft(PURCHASE_DRAFT_KEY);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Periksa kembali hasil scan sebelum disimpan.");
    }
  };

  if (!store.hydrated) return <main className="kulakan-page loading">Membuka rekap kulakan…</main>;

  return <main className="kulakan-page">
    <section className="kulakan-hero">
      <h1>PEMINDAI STRUK CERDAS</h1>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => void scan(event.target.files?.[0])}/>
      <button className="scan-button" onClick={() => inputRef.current?.click()} disabled={loading || Boolean(draft)}>
        {loading ? <LoaderCircle className="spin" size={20}/> : <Camera size={20}/>} {loading ? "Memproses struk…" : "Pindai struk"}
      </button>
      <button className="manual-purchase-button" type="button" onClick={startManual} disabled={loading || Boolean(draft)}><FilePenLine size={19}/> Input Kulakan Manual</button>

      <small>{draft ? "Simpan atau batalkan draft saat ini sebelum memulai pencatatan baru." : "Maks. ukuran gambar 10 MB · Pastikan tulisan pada struk terang, fokus, dan terbaca jelas."}</small>
    </section>

    {scanStage && <div className="scan-progress" role="status" aria-live="polite"><LoaderCircle className="spin" size={22}/><div><strong>{scanStage === "preparing" ? "Menyiapkan foto struk…" : "Menganalisis isi struk…"}</strong><span>{scanStage === "preparing" ? "Mengoptimalkan ukuran foto agar proses lebih cepat." : "Membaca toko, barang, jumlah, dan harga. Mohon tunggu."}</span></div></div>}

    {error && <div className="scan-error" role="alert">{error}</div>}

    {draft ? <section className="receipt-review">
      <div className="section-title"><div><span>DRAFT KULAKAN</span><h2>Periksa sebelum disimpan</h2></div><ReceiptText size={24}/></div>
      <div className="review-grid">
        <label><span>Toko grosir</span><input value={draft.merchantName} onChange={e => setDraft({...draft, merchantName:e.target.value})}/></label>
        <label><span>Tanggal</span><input type="date" value={draft.purchaseDate} onChange={e => setDraft({...draft, purchaseDate:e.target.value})}/></label>
      </div>
      <div className="receipt-items">{draft.items.map((item,index)=><article key={item.id} className="receipt-item">
        <div className="item-number">{index+1}</div>
        <div className="item-edit">
          <input aria-label={`Nama barang ${index+1}`} value={item.itemName} onChange={e=>updateItem(item.id,{itemName:e.target.value})}/>
          <div><label>Qty<input aria-label={`Qty ${index+1}`} type="number" min="0.01" step="0.01" value={item.qty} onChange={e=>updateItem(item.id,{qty:Number(e.target.value)})}/></label><label>Satuan<input aria-label={`Satuan ${index+1}`} value={item.unit} onChange={e=>updateItem(item.id,{unit:e.target.value})}/></label></div>
          <label>Harga modal / unit<input aria-label={`Harga modal ${index+1}`} type="number" min="1" step="1" value={item.unitPrice} onChange={e=>updateItem(item.id,{unitPrice:Number(e.target.value)})}/></label>
        </div>
        <div className="price-stack"><strong>Subtotal {formatIDR(item.qty * item.unitPrice)}</strong></div>
      </article>)}</div>
      <button className="add-manual-item" type="button" onClick={() => setDraft(current => current ? {...current, items:[...current.items, { id:crypto.randomUUID(), itemName:"", qty:1, unit:"", unitPrice:1, totalPrice:1 }]} : current)}><Plus size={17}/> Tambah barang</button>
      <div className="receipt-total"><span>Total belanja terhitung</span><strong>{formatIDR(reviewedTotal)}</strong></div>
      <div className="purchase-draft-actions"><button type="button" onClick={() => { setDraft(null); draftIdentityRef.current = null; clearFormDraft(PURCHASE_DRAFT_KEY); setError(""); }}>Batalkan draft</button><button className="save-purchase" onClick={save}><Save size={19}/> Simpan ke rekap belanja</button></div>
    </section> : <section className="purchase-history">
      <div className="section-title"><div><span>RIWAYAT BELANJA</span><h2>Struk tersimpan</h2></div><b>{store.purchases.length}</b></div>
      {store.purchases.length ? store.purchases.map(purchase=>{
        const expanded = expandedPurchaseId === purchase.id;
        return <article className={`purchase-card${expanded ? " expanded" : ""}`} key={purchase.id}>
          <button className="purchase-summary" type="button" aria-expanded={expanded} aria-controls={`purchase-detail-${purchase.id}`} aria-label={`${expanded ? "Tutup" : "Lihat"} detail ${purchase.merchantName}`} onClick={()=>setExpandedPurchaseId(expanded ? null : purchase.id)}>
            <div className="purchase-icon"><PackageOpen size={21}/></div>
            <div className="purchase-meta"><h3>{purchase.merchantName}</h3><p>{formatDate(purchase.purchaseDate)} · {purchase.items.length} barang</p></div>
            <strong>{formatIDR(purchase.grandTotal)}</strong>
            {expanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          </button>
          {expanded && <div className="purchase-detail" id={`purchase-detail-${purchase.id}`}>
            <div className="purchase-detail-heading"><span>DETAIL BELANJA</span><b>{purchase.items.length} item</b></div>
            <div className="purchase-detail-items">{purchase.items.map((item,index)=><div className="purchase-detail-item" key={item.id}>
              <div className="purchase-detail-name"><span>{index+1}</span><strong>{item.itemName}</strong></div>
              <p>{item.qty} {item.unit} × {formatIDR(item.unitPrice)}</p>
              <dl><div><dt>Subtotal belanja</dt><dd>{formatIDR(item.totalPrice)}</dd></div></dl>
            </div>)}</div>
            <div className="purchase-detail-total"><span>Total modal belanja</span><strong>{formatIDR(purchase.grandTotal)}</strong></div>
            <a className="purchase-whatsapp" href={buildPurchaseWhatsAppUrl(purchase)} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Rekap ke WhatsApp</a>
          </div>}
        </article>;
      }) : <div className="empty purchase-empty"><div><ReceiptText size={28}/></div><h3>Belum ada struk kulakan</h3><p>Scan struk pertama untuk mulai membuat rekap modal barang.</p></div>}
    </section>}
  </main>;
}
