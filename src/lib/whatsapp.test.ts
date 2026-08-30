import { expect, it } from "vitest";
import { buildWhatsAppReminderUrl } from "./whatsapp";
import type { DebtItem } from "@/types";
const debt: DebtItem={id:"1",customerName:"Siti",phoneNumber:"0812-1234",itemsDescription:"Minyak 2L",totalAmount:50000,remainingAmount:25000,status:"PARTIAL",createdAt:"now",paymentHistory:[]};
it("builds encoded wa.me reminder",()=>{ const url=buildWhatsAppReminderUrl(debt,{storeName:"Warung Makmur",ownerName:"Ibu Ani",paymentInfo:"QRIS tersedia"}); expect(url).toContain("https://wa.me/628121234?text="); expect(decodeURIComponent(url)).toContain("*Sisa Tagihan:* *Rp 25.000*"); });
