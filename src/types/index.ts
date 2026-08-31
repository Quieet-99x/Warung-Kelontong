export type DebtStatus = "UNPAID" | "PARTIAL" | "PAID";
export interface PaymentRecord { id:string; amountPaid:number; paidAt:string; }
export interface DebtItem { id:string; customerName:string; phoneNumber:string; itemsDescription:string; totalAmount:number; remainingAmount:number; status:DebtStatus; createdAt:string; dueDate?:string; paymentHistory:PaymentRecord[]; }
export interface StoreProfile { storeName:string; ownerName:string; paymentInfo?:string; qrisImageBase64?:string; }
