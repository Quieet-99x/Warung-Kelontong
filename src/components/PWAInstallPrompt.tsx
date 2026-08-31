"use client";

import { Download, RefreshCw, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { activateWaitingWorker } from "@/lib/pwa-update";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandalone = () => typeof window !== "undefined"
  && (window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true));

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const versionRef = useRef<string | null>(null);

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
      setDismissed(false);
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
  return <aside className="pwa-banner install" role="status">
    {showIos ? <Share2 size={21}/> : <Download size={21}/>}<div><strong>Pasang Buku Warung</strong><span>{showIos ? "Ketuk Bagikan, lalu Tambahkan ke Layar Utama." : "Buka lebih cepat dari layar utama HP."}</span></div>
    {installEvent && <button type="button" onClick={() => void install()}>Pasang aplikasi</button>}
    <button className="pwa-dismiss" type="button" aria-label="Tutup panduan pemasangan" onClick={() => setDismissed(true)}><X size={18}/></button>
  </aside>;
}
