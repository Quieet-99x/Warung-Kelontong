import type { PurchaseReceipt } from "@/types/receipt";
import { formatDate, formatIDR } from "./utils";

const compactIDR = (amount: number) => formatIDR(amount).replace(/\s/g, "");

export function buildPurchaseWhatsAppUrl(purchase: PurchaseReceipt): string {
  const itemLines = purchase.items.map((item, index) => [
    `${index + 1}. *${item.itemName}*`,
    `   ${item.qty} ${item.unit} × ${compactIDR(item.unitPrice)}`,
    `   Subtotal: ${compactIDR(item.totalPrice)}`,
    item.recommendedSellPrice ? `   Rekomendasi jual: ${compactIDR(item.recommendedSellPrice)} / ${item.unit}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  const message = `*REKAP KULAKAN*\n\n🏪 *Toko:* ${purchase.merchantName}\n📅 *Tanggal:* ${formatDate(purchase.purchaseDate)}\n📦 *Jumlah barang:* ${purchase.items.length}\n\n${itemLines}\n\n💰 *TOTAL MODAL: ${compactIDR(purchase.grandTotal)}*\n\n_Data dicatat dari Buku Kasbon Warung._`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
