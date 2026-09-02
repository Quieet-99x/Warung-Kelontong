"use client";

import { Camera, Keyboard, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { feedback } from "@/lib/feedback";
import { Modal } from "./Modal";

export function BarcodeScanner({ open, title, onClose, onDetected }: { open: boolean; title: string; onClose: () => void; onDetected: (barcode: string) => void }) {
  const readerId = `barcode-reader-${useId().replaceAll(":", "")}`;
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const detectedRef = useRef(false);
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [starting, setStarting] = useState(false);

  const submit = useCallback((barcode: string) => {
    const value = barcode.trim();
    if (!value || detectedRef.current) return;
    detectedRef.current = true;
    feedback.playBeep();
    feedback.triggerHaptic(80);
    onDetected(value);
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    detectedRef.current = false;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) { setCameraError(""); setStarting(true); } });
    void import("html5-qrcode").then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(readerId, { formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.CODE_128,
      ], verbose: false });
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 150 } }, submit, () => {});
    }).catch(() => { if (!cancelled) setCameraError("Kamera tidak tersedia. Masukkan barcode secara manual."); })
      .finally(() => { if (!cancelled) setStarting(false); });
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try { void scanner.stop().catch(() => {}).finally(() => { try { scanner.clear(); } catch {} }); }
        catch { try { scanner.clear(); } catch {} }
      }
    };
  // readerId remains stable for this component instance.
  }, [open, readerId, submit]);

  return <Modal open={open} title={title} subtitle="EAN-13, UPC-A, ITF-14, dan Code-128" onClose={onClose}>
    <div className="barcode-scanner">
      <div id={readerId} className="barcode-reader" aria-label="Pratinjau kamera barcode"/>
      {starting && <p role="status"><LoaderCircle className="spin" size={16}/> Menyiapkan kamera…</p>}
      {cameraError && <p role="alert">{cameraError}</p>}
      <form onSubmit={event => { event.preventDefault(); submit(manual); }}>
        <label className="field"><span><Keyboard size={15}/> Nomor barcode</span><input aria-label="Nomor barcode" inputMode="text" autoComplete="off" value={manual} onChange={event => setManual(event.target.value)}/></label>
        <button className="primary" type="submit"><Camera size={17}/> Gunakan barcode</button>
      </form>
    </div>
  </Modal>;
}
