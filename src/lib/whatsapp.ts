import type { DebtItem, StoreProfile } from "@/types";
import { formatIDR, sanitizePhoneNumber } from "./utils";

export function buildWhatsAppReminderUrl(debt: DebtItem, store: StoreProfile): string {
  const payment = store.paymentInfo ? `\n- *Pembayaran:* ${store.paymentInfo}` : "";
  const message = `Halo *${debt.customerName}*, salam hangat dari *${store.storeName}*.

Berikut pengingat kasbon Anda:
- *Barang:* ${debt.itemsDescription}
- *Sisa tagihan:* *${formatIDR(debt.remainingAmount)}*${payment}

Pembayaran dapat dilakukan saat mampir ke warung atau melalui metode pembayaran di atas.

Terima kasih.`;

  return `https://wa.me/${sanitizePhoneNumber(debt.phoneNumber)}?text=${encodeURIComponent(message)}`;
}
