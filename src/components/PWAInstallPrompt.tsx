"use client";

import { Download, RefreshCw, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { activateWaitingWorker, INSTALL_DISMISSED_KEY } from "@/lib/pwa-update";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandalone = () => typeof window !== "undefined"
  && (window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true));
const wasDismissed = () => {
  try { return sessionStorage.getItem(INSTALL_DISMISSED_KEY) === "1"; }
  catch { return false; }
};
const dismissForSession = () => {
  try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, "1"); }
  catch {}
};

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const versionRef = useRef<string | null>(null);
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch("/api/app-version", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { version?: string };
      if (!payload.version) return;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(payload.version)}`, { scope: "/" });
        registrationRef.current = registration;
      }
      if (versionRef.current && versionRef.current !== payload.version) setUpdateAvailable(true);
      versionRef.current = payload.version;
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setDismissed(wasDismissed());
    };
    const onInstalled = () => { setInstallEvent(null); setShowIos(false); };
    const onVisible = () => { if (document.visibilityState === "visible") void checkVersion(); };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("visibilitychange", onVisible);
    const initialCheck = window.setTimeout(() => {
      setShowIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone());
      void checkVersion();
    }, 0);
    const interval = window.setInterval(() => void checkVersion(), 5 * 60_000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [checkVersion]);

  const dismiss = useCallback(() => {
    dismissForSession();
    setDismissed(true);
  }, []);

  useEffect(() => {
    const open = !updateAvailable && !dismissed && !isStandalone() && Boolean(installEvent || showIos);
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dismissRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) dismissRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [dismiss, dismissed, installEvent, showIos, updateAvailable]);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };
  const update = async () => {
    const registration = registrationRef.current;
    if (!registration) return;
    try {
      await activateWaitingWorker(registration, navigator.serviceWorker, () => window.location.reload());
    } catch {}
  };

  if (updateAvailable) return <aside className="pwa-banner update" role="status">
    <RefreshCw size={21}/><div><strong>Versi baru tersedia</strong><span>Perbarui saat transaksi atau formulir sudah selesai.</span></div>
    <button type="button" onClick={() => void update()}>Perbarui sekarang</button>
  </aside>;

  if (dismissed || isStandalone() || (!installEvent && !showIos)) return null;
  return <div className="pwa-install-backdrop" role="presentation">
    <aside ref={dialogRef} className="pwa-install-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <button ref={dismissRef} className="pwa-dismiss" type="button" aria-label="Tutup panduan pemasangan" onClick={dismiss}><X size={18}/></button>
      <div className="pwa-install-icon">{showIos ? <Share2 size={24}/> : <Download size={24}/>}</div>
      <div><strong id="pwa-install-title">Pasang Buku Warung</strong><span>{showIos ? "Ketuk Bagikan, lalu Tambahkan ke Layar Utama." : "Akses warung lebih cepat, bahkan saat koneksi sedang tidak stabil."}</span></div>
      {installEvent && <button className="pwa-install-action" type="button" onClick={() => void install()}>Pasang aplikasi</button>}
      {showIos && <small>Anda dapat memasangnya nanti dari menu Bagikan Safari.</small>}
    </aside>
  </div>;
}
