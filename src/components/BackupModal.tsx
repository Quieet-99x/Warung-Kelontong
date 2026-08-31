"use client";

import { DatabaseBackup, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { DebtItem, StoreProfile } from "@/types";
import type { Checkpoint } from "@/lib/backup";
import {
  buildCheckpoint,
  buildMonthlyCSV,
  downloadTextFile,
  MAX_CHECKPOINT_BYTES,
  parseCheckpoint,
  readCurrentBackup,
  restoreCheckpoint,
} from "@/lib/backup";
import { Modal } from "./Modal";

interface BackupModalProps {
  open: boolean;
  onClose: () => void;
  storeProfile: StoreProfile;
  debts: DebtItem[];
  onRestored: () => void;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function BackupModal({ open, onClose, storeProfile, debts, onRestored }: BackupModalProps) {
  const [month, setMonth] = useState(currentMonth);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [currentCounts, setCurrentCounts] = useState<{ debts: number; receipts: number; closings: number; inventory: number } | null>(null);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backupDate = useMemo(() => checkpoint ? new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(checkpoint.backupDate)) : "", [checkpoint]);

  const downloadCSV = () => {
    try {
      const data = readCurrentBackup(localStorage, { storeProfile, debts, receipts: [] });
      const csv = buildMonthlyCSV(month, data.debts, data.receipts);
      downloadTextFile(csv, "text/csv;charset=utf-8", `Rekap_Warung_${month}.csv`);
      setStatus({ kind: "success", message: `Rekap ${month} berhasil disiapkan.` });
    } catch (reason) {
      setStatus({ kind: "error", message: reason instanceof Error ? reason.message : "Gagal membuat rekap." });
    }
  };

  const downloadCheckpoint = () => {
    try {
      const fallback = { storeProfile, debts, receipts: [] };
      const data = readCurrentBackup(localStorage, fallback);
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(buildCheckpoint(data), "application/json;charset=utf-8", `Checkpoint_Warung_${date}.json`);
      setStatus({ kind: "success", message: "Checkpoint lengkap berhasil disiapkan." });
    } catch (reason) {
      setStatus({ kind: "error", message: reason instanceof Error ? reason.message : "Gagal membuat checkpoint." });
    }
  };

  const selectFile = async (file?: File) => {
    setCheckpoint(null);
    setCurrentCounts(null);
    setStatus(null);
    if (!file) return;
    try {
      if (file.size > MAX_CHECKPOINT_BYTES) throw new Error("File checkpoint terlalu besar.");
      const parsed = parseCheckpoint(await file.text());
      setCheckpoint(parsed);
      try {
        const current = readCurrentBackup(localStorage, { storeProfile, debts, receipts: [] });
        setCurrentCounts({ debts: current.debts.length, receipts: current.receipts.length, closings: current.dailyClosings?.length ?? 0, inventory: current.inventory?.length ?? 0 });
      } catch {
        setCurrentCounts(null);
      }
    } catch (reason) {
      setStatus({ kind: "error", message: `Gagal membaca checkpoint. ${reason instanceof Error ? reason.message : "File tidak valid."}` });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirmRestore = () => {
    if (!checkpoint) return;
    try {
      restoreCheckpoint(localStorage, checkpoint.data);
      setStatus({ kind: "success", message: "Data berhasil dipulihkan. Aplikasi akan memuat ulang." });
      setCheckpoint(null);
      onRestored();
    } catch (reason) {
      setStatus({ kind: "error", message: reason instanceof Error ? reason.message : "Gagal memulihkan data." });
    }
  };

  return <Modal open={open} onClose={onClose} title="Pusat Data & Cadangan" subtitle="Pisahkan file laporan dan cadangan pemulihan">
    <div className="backup-center">
      {status && <div className={`backup-status ${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</div>}

      <section className="backup-section">
        <div className="backup-section-title"><FileSpreadsheet size={20}/><div><span>1. REKAP BULANAN</span><h3>Untuk Excel / Google Sheets</h3></div></div>
        <label className="backup-month"><span>Pilih bulan</span><input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
        <button type="button" className="backup-action primary-backup" onClick={downloadCSV}><Download size={18}/> Download Rekap Excel (.csv)</button>
        <p>Untuk dibaca di Excel/Google Sheets. Berisi kasbon, kulakan, dan ringkasan total bulan terpilih.</p>
      </section>

      <section className="backup-section checkpoint-section">
        <div className="backup-section-title"><DatabaseBackup size={20}/><div><span>2. CADANGAN LENGKAP</span><h3>Backup & pulihkan seluruh aplikasi</h3></div></div>
        <div className="backup-subsection"><strong>Buat salinan baru</strong><button type="button" className="backup-action" onClick={downloadCheckpoint}><Download size={18}/> Download Checkpoint (.json)</button></div>
        <div className="backup-divider"/>
        <div className="backup-subsection"><strong>Pulihkan / pindah ke HP baru</strong>
          <label className="backup-upload"><Upload size={18}/> Upload & Periksa File<input ref={inputRef} aria-label="Pilih file checkpoint" type="file" accept=".json,application/json" onChange={event => void selectFile(event.target.files?.[0])}/></label>
          <small>Untuk pindah HP atau memulihkan data. File diperiksa dahulu; data tidak langsung ditimpa.</small>
        </div>
      </section>

      <span className="backup-scroll-cue" aria-hidden="true">Geser untuk melihat seluruh opsi</span>

      {checkpoint && <section className="restore-confirm" aria-label="Konfirmasi pemulihan data">
        <div className="restore-warning"><RotateCcw size={21}/><div><strong>Peringatan Pemulihan Data</strong><p>Cadangan “{checkpoint.data.storeProfile.storeName}” · {backupDate}</p></div></div>
        <div className="restore-comparison">
          <span>Saat ini<strong>{currentCounts ? `${currentCounts.debts} kasbon · ${currentCounts.receipts} struk · ${currentCounts.inventory} stok · ${currentCounts.closings} tutup buku` : "Data saat ini bermasalah"}</strong></span>
          <span>Akan menjadi<strong>{checkpoint.data.debts.length} kasbon · {checkpoint.data.receipts.length} struk · ${checkpoint.data.inventory?.length ?? 0} stok · ${checkpoint.data.dailyClosings?.length ?? 0} tutup buku</strong></span>
        </div>
        <p>Memulihkan data akan menggantikan—bukan menggabungkan—seluruh data yang ada saat ini di HP ini. Pastikan file yang dipilih benar.</p>
        <div className="restore-actions"><button type="button" onClick={() => setCheckpoint(null)}>Batal</button><button type="button" className="restore-danger" onClick={confirmRestore}>Ya, Pulihkan Data</button></div>
      </section>}
    </div>
  </Modal>;
}
