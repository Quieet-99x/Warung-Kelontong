"use client";

import { CalendarClock, MessageCircle, MoreVertical, Plus, Trash2, WalletCards } from "lucide-react";
import { useState } from "react";
import type { DebtItem, StoreProfile } from "@/types";
import { formatDate, formatIDR } from "@/lib/utils";
import { buildWhatsAppReminderUrl } from "@/lib/whatsapp";

export function DebtCard({ debt, store, onPay, onAdd, onDelete }: {
  debt: DebtItem;
  store: StoreProfile;
  onPay: () => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = Math.round(((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100);

  return <article className="debt-card">
    <div className="debt-top">
      <div className="avatar">{debt.customerName.slice(0, 1).toUpperCase()}</div>
      <div className="customer"><h3>{debt.customerName}</h3><p>{debt.phoneNumber}</p></div>
      <div className="debt-card-tools">
        <span className={`status ${debt.status.toLowerCase()}`}>{debt.status === "UNPAID" ? "Belum bayar" : "Cicilan"}</span>
        <button className="debt-menu-trigger" type="button" aria-label={`Menu kasbon ${debt.customerName}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreVertical size={19}/></button>
        {menuOpen && <div className="debt-menu"><button type="button" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={16}/> Hapus kasbon</button></div>}
      </div>
    </div>
    <div className="debt-detail"><p>{debt.itemsDescription}</p><span><CalendarClock size={14}/> Dicatat {formatDate(debt.createdAt)}{debt.dueDate ? ` · Jatuh tempo ${formatDate(debt.dueDate)}` : ""}</span></div>
    <div className="amount-row"><div><small>Sisa kasbon</small><strong>{formatIDR(debt.remainingAmount)}</strong></div>{debt.status === "PARTIAL" && <div className="progress-wrap"><small>{progress}% terbayar</small><div className="progress"><i style={{ width: `${progress}%` }}/></div></div>}</div>
    <div className="card-actions">
      <button onClick={onAdd}><Plus size={16}/> Tambah kasbon</button>
      <button className="pay" onClick={onPay}><WalletCards size={16}/> Bayar / Cicil</button>
      <a className="whatsapp-action" href={buildWhatsAppReminderUrl(debt, store)} target="_blank" rel="noreferrer" aria-label={`Hubungi ${debt.customerName} via WhatsApp`}>
        <span className="whatsapp-mark"><MessageCircle size={22}/></span>
      </a>
    </div>
  </article>;
}
