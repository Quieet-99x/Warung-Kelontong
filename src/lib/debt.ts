import type { DebtItem } from "@/types";

function assertValidAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal harus berupa angka lebih dari nol");
  }
}

export function addAmountToDebt(debt: DebtItem, amount: number, description?: string): DebtItem {
  assertValidAmount(amount);
  return {
    ...debt,
    totalAmount: debt.totalAmount + amount,
    remainingAmount: debt.remainingAmount + amount,
    status: debt.status === "PAID" ? "PARTIAL" : debt.status,
    itemsDescription: description ? `${debt.itemsDescription}; ${description}` : debt.itemsDescription,
  };
}

export function applyPayment(debt: DebtItem, amount: number, id: string, paidAt: string): DebtItem {
  assertValidAmount(amount);
  const actual = Math.min(amount, debt.remainingAmount);
  const remaining = debt.remainingAmount - actual;
  return {
    ...debt,
    remainingAmount: remaining,
    status: remaining === 0 ? "PAID" : "PARTIAL",
    paymentHistory: [...debt.paymentHistory, { id, amountPaid: actual, paidAt }],
  };
}
