"use client";

import { Info, QrCode } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import type { StoreProfile } from "@/types";
import { formatIDR } from "@/lib/utils";
import { feedback } from "@/lib/feedback";
import { Modal } from "./Modal";

export default function QRISModal({ open, onClose, store, amount }: {
  open: boolean;
  onClose: () => void;
  store: StoreProfile;
  amount: number;
}) {
  useEffect(() => {
    if (open) feedback.playBeep();
  }, [open]);
  return <Modal open={open} onClose={onClose} title="Bayar pakai QRIS" subtitle={store.storeName}>
    <div className="qris-modal-content">
      {store.qrisImageBase64
        ? <div className="qris-image-frame"><Image unoptimized src={store.qrisImageBase64} width={1200} height={1200} alt={`QRIS ${store.storeName}`}/></div>
        : <div className="qris-empty"><QrCode size={42}/><strong>Foto QRIS belum diunggah</strong><p>Silakan unggah foto QRIS warung Anda di menu Pengaturan.</p></div>}
      <div className="qris-amount"><span>Total yang perlu dibayar</span><strong>{formatIDR(amount).replace(/\s/g, "")}</strong></div>
      <p className="qris-guidance"><Info size={17}/> QRIS ini bersifat statis. Setelah memindai, pembeli perlu memasukkan nominal tersebut di aplikasi pembayaran.</p>
      <button className="primary qris-close" type="button" onClick={onClose}>Tutup Layar QRIS</button>
    </div>
  </Modal>;
}
