import { expect, it } from "vitest";
import { buildWhatsAppReminderUrl } from "./whatsapp";
import type { DebtItem } from "@/types";
const debt: DebtItem={id:"1",customerName:"Siti",phoneNumber:"0812-1234",itemsDescription:"Minyak 2L",totalAmount:50000,remainingAmount:25000,status:"PARTIAL",createdAt:"now",paymentHistory:[]};
it("builds an emoji-free encoded wa.me reminder",()=>{ const url=buildWhatsAppReminderUrl(debt,{storeName:"Warung Makmur",ownerName:"Ibu Ani",paymentInfo:"QRIS tersedia"}); const message=new URL(url).searchParams.get("text")??""; expect(url).toContain("https://wa.me/628121234?text="); expect(message).toContain("*Sisa tagihan:* *Rp 25.000*"); expect(message).toContain("*Pembayaran:* QRIS tersedia"); expect(message).not.toMatch(/[\p{Extended_Pictographic}\uFFFD]/u); });
