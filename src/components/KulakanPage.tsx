"use client";

import imageCompression from "browser-image-compression";
import { feedback } from "@/lib/feedback";
import { Camera, ChevronDown, ChevronRight, LoaderCircle, MessageCircle, PackageOpen, ReceiptText, Save, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { usePurchaseStore } from "@/hooks/usePurchaseStore";
import { createPurchase } from "@/lib/purchase";
import { buildPurchaseWhatsAppUrl } from "@/lib/purchase-whatsapp";
import { applyMargin } from "@/lib/receipt";
import { formatDate, formatIDR } from "@/lib/utils";
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
  const draftIdentityRef = useRef<{ id: string; createdAt: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [margin, setMargin] = useState(15);
  const [rounding, setRounding] = useState<500 | 1000>(500);
  const [loading, setLoading] = useState(false);
  const [scanStage, setScanStage] = useState<"preparing" | "analyzing" | null>(null);
  const [error, setError] = useState("");
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const pricedItems = useMemo(() => draft ? applyMargin(draft.items, margin, rounding) : [], [draft, margin, rounding]);
  const reviewedTotal = useMemo(() => pricedItems.reduce((total, item) => total + item.qty * item.unitPrice, 0), [pricedItems]);

  const scan = async (file?: File) => {
    if (!file) return;
    setError("");
    setLoading(true);
    setScanStage("preparing");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Pilih file foto struk yang valid.");
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
      const receipt = createPurchase(draft, margin, rounding, identity.id, identity.createdAt);
      if (!(onSavePurchase ?? store.savePurchase)(receipt)) throw new Error("Struk dan stok belum dapat disimpan. Periksa nama barang, satuan, dan penyimpanan perangkat.");
      setDraft(null);
      draftIdentityRef.current = null;
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Periksa kembali hasil scan sebelum disimpan.");
    }
  };

  if (!store.hydrated) return <main className="kulakan-page loading">Membuka rekap kulakan…</main>;

  return <main className="kulakan-page">
    <section className="kulakan-hero">
      <div className="eyebrow"><Sparkles size={14}/> PEMINDAI STRUK CERDAS</div>
      <h1>Rekap kulakan</h1>
      <p>Unggah foto struk kulakan, periksa hasil pembacaan, lalu simpan modal dan rekomendasi harga jual.</p>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => void scan(event.target.files?.[0])}/>
      <button className="scan-button" onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={20}/> : <Camera size={20}/>} {loading ? "Memproses struk…" : "Pindai struk"}
      </button>
      <small>Foto dioptimalkan sebelum dianalisis. Selalu periksa nama barang, jumlah, dan harga sebelum menyimpan.</small>
    </section>

    {scanStage && <div className="scan-progress" role="status" aria-live="polite"><LoaderCircle className="spin" size={22}/><div><strong>{scanStage === "preparing" ? "Menyiapkan foto struk…" : "Menganalisis isi struk…"}</strong><span>{scanStage === "preparing" ? "Mengoptimalkan ukuran foto agar proses lebih cepat." : "Membaca toko, barang, jumlah, dan harga. Mohon tunggu."}</span></div></div>}

    {error && <div className="scan-error" role="alert">{error}</div>}

    {draft ? <section className="receipt-review">
      <div className="section-title"><div><span>HASIL SCAN</span><h2>Periksa sebelum disimpan</h2></div><ReceiptText size={24}/></div>
      <div className="review-grid">
        <label><span>Toko grosir</span><input value={draft.merchantName} onChange={e => setDraft({...draft, merchantName:e.target.value})}/></label>
        <label><span>Tanggal</span><input type="date" value={draft.purchaseDate} onChange={e => setDraft({...draft, purchaseDate:e.target.value})}/></label>
      </div>
      <div className="margin-panel">
        <div><strong>Margin laba {margin}%</strong><span>Pembulatan harga jual</span></div>
        <input aria-label="Margin laba" type="range" min="0" max="100" step="5" value={margin} onChange={e=>setMargin(Number(e.target.value))}/>
        <div className="rounding-toggle"><button className={rounding===500?"active":""} onClick={()=>setRounding(500)}>Rp500</button><button className={rounding===1000?"active":""} onClick={()=>setRounding(1000)}>Rp1.000</button></div>
      </div>
      <div className="receipt-items">{pricedItems.map((item,index)=><article key={item.id} className="receipt-item">
        <div className="item-number">{index+1}</div>
        <div className="item-edit">
          <input aria-label={`Nama barang ${index+1}`} value={item.itemName} onChange={e=>updateItem(item.id,{itemName:e.target.value})}/>
          <div><label>Qty<input type="number" min="0.01" step="0.01" value={item.qty} onChange={e=>updateItem(item.id,{qty:Number(e.target.value)})}/></label><label>Satuan<input value={item.unit} onChange={e=>updateItem(item.id,{unit:e.target.value})}/></label></div>
          <label>Harga modal / unit<input type="number" min="1" step="1" value={item.unitPrice} onChange={e=>updateItem(item.id,{unitPrice:Number(e.target.value)})}/></label>
        </div>
        <div className="price-stack"><span>Modal {formatIDR(item.unitPrice)}</span><strong>Jual {formatIDR(item.recommendedSellPrice||0)}</strong></div>
      </article>)}</div>
      <div className="receipt-total"><span>Total belanja terhitung</span><strong>{formatIDR(reviewedTotal)}</strong></div>
      <button className="save-purchase" onClick={save}><Save size={19}/> Simpan ke rekap belanja</button>
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
              <dl><div><dt>Subtotal modal</dt><dd>{formatIDR(item.totalPrice)}</dd></div><div><dt>Rekomendasi jual</dt><dd>{formatIDR(item.recommendedSellPrice || 0)} / {item.unit}</dd></div></dl>
            </div>)}</div>
            <div className="purchase-detail-total"><span>Total modal belanja</span><strong>{formatIDR(purchase.grandTotal)}</strong></div>
            <a className="purchase-whatsapp" href={buildPurchaseWhatsAppUrl(purchase)} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Rekap ke WhatsApp</a>
          </div>}
        </article>;
      }) : <div className="empty purchase-empty"><div><ReceiptText size={28}/></div><h3>Belum ada struk kulakan</h3><p>Scan struk pertama untuk mulai membuat rekap modal barang.</p></div>}
    </section>}
  </main>;
}
