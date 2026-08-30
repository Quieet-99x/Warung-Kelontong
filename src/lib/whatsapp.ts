import type { DebtItem,StoreProfile } from "@/types";
import {formatIDR,sanitizePhoneNumber} from "./utils";
export function buildWhatsAppReminderUrl(debt:DebtItem,store:StoreProfile):string { const message=`Halo *${debt.customerName}*, salam hangat dari *${store.storeName}* 👋.

Sekadar catatan pengingat titipan belanjaan:
🛒 *Barang:* ${debt.itemsDescription}
💰 *Sisa Tagihan:* *${formatIDR(debt.remainingAmount)}*${store.paymentInfo?`

💳 *Pembayaran:* ${store.paymentInfo}`:""}

Bisa dibayarkan saat mampir ke warung atau via transfer. Terima kasih banyak! 🙏`; return `https://wa.me/${sanitizePhoneNumber(debt.phoneNumber)}?text=${encodeURIComponent(message)}`; }
