export interface ReceiptItem {
  id: string;
  itemName: string;
  qty: number;
  unit: string;
  totalPrice: number;
  unitPrice: number;
  recommendedSellPrice?: number;
  inventoryItemId?: string;
  barcode?: string;
  unitConversion?: number;
}

export interface PurchaseReceipt {
  id: string;
  merchantName: string;
  purchaseDate: string;
  items: ReceiptItem[];
  grandTotal: number;
  rawImageUrl?: string;
  createdAt: string;
}

export type ReceiptExtraction = Omit<PurchaseReceipt, "id" | "createdAt" | "rawImageUrl">;
