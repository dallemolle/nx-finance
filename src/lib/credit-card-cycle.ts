import { Decimal } from "decimal.js";

export interface InvoiceMonth {
    month: number; // 1-12
    year: number;
}

// Regra padrão de cartão de crédito: uma compra feita no dia D cai na fatura
// do mês atual se D < closingDay; se D >= closingDay, o ciclo já fechou e a
// compra vai para a fatura do mês seguinte.
export function getInvoiceReferenceMonth(purchaseDate: Date, closingDay: number): InvoiceMonth {
    const day = purchaseDate.getDate();
    let month = purchaseDate.getMonth() + 1;
    let year = purchaseDate.getFullYear();
    if (day >= closingDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return { month, year };
}

// Soma `offset` meses a uma fatura de referência (usado para projetar cada
// parcela seguinte a partir da 1ª).
export function addInvoiceMonths(month: number, year: number, offset: number): InvoiceMonth {
    const totalMonths = year * 12 + (month - 1) + offset;
    return {
        month: (totalMonths % 12) + 1,
        year: Math.floor(totalMonths / 12),
    };
}

// Vencimento da fatura do mês M no dia dueDay — mas só nesse mesmo mês M se
// dueDay > closingDay. Quando dueDay <= closingDay (caso comum: fecha dia 25,
// vence dia 5), o vencimento cai no dueDay do mês SEGUINTE a M — senão o
// vencimento ficaria antes do próprio fechamento da fatura, o que não faz
// sentido cronologicamente.
export function computeInvoiceDueDate(invoiceMonth: number, invoiceYear: number, closingDay: number, dueDay: number): Date {
    let dueMonth = invoiceMonth;
    let dueYear = invoiceYear;
    if (dueDay <= closingDay) {
        dueMonth += 1;
        if (dueMonth > 12) {
            dueMonth = 1;
            dueYear += 1;
        }
    }
    // Clamp para o último dia do mês, caso dueDay (ex: 31) não exista nesse mês
    const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
    return new Date(dueYear, dueMonth - 1, Math.min(dueDay, daysInDueMonth));
}

// Inverso de computeInvoiceDueDate: dado o vencimento real de uma fatura já
// importada, descobre a que "mês de referência" (ciclo de fechamento) M ela
// corresponde — necessário pra conciliar uma fatura real com faturas
// projetadas, que são indexadas por mês de referência, não por vencimento.
export function getReferenceMonthFromDueDate(dueDate: Date, closingDay: number, dueDay: number): InvoiceMonth {
    let month = dueDate.getMonth() + 1;
    let year = dueDate.getFullYear();
    if (dueDay <= closingDay) {
        month -= 1;
        if (month < 1) {
            month = 12;
            year -= 1;
        }
    }
    return { month, year };
}

export interface InstallmentSplit {
    value: Decimal;
}

// Split cents-accurate: mesma lógica de createTransaction (src/lib/actions.ts)
// — divide com arredondamento pra baixo e a última parcela absorve o
// centavo residual, pra soma das parcelas bater exatamente com o total.
export function splitInstallments(totalValue: Decimal, count: number): InstallmentSplit[] {
    const installmentValue = totalValue.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const lastInstallmentValue = totalValue.minus(installmentValue.times(count - 1));
    return Array.from({ length: count }, (_, i) => ({
        value: i === count - 1 ? lastInstallmentValue : installmentValue,
    }));
}
