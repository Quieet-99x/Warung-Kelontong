"use client";

import { BookOpenCheck, ReceiptText } from "lucide-react";
import { useState } from "react";
import Dashboard from "./Dashboard";
import KulakanPage from "./KulakanPage";

export default function WarungApp() {
  const [page, setPage] = useState<"kasbon" | "kulakan">("kasbon");
  return <div className="warung-app">
    <div hidden={page !== "kasbon"}><Dashboard/></div>
    <div hidden={page !== "kulakan"}><KulakanPage/></div>
    <nav className="app-bottom-nav" aria-label="Navigasi utama">
      <button className={page === "kasbon" ? "active" : ""} onClick={() => setPage("kasbon")}><BookOpenCheck size={19}/><span>Kasbon</span></button>
      <button className={page === "kulakan" ? "active" : ""} onClick={() => setPage("kulakan")}><ReceiptText size={19}/><span>Kulakan</span></button>
    </nav>
  </div>;
}
