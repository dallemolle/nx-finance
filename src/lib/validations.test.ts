import { describe, expect, test } from "vitest";
import { cardInstallmentPurchaseSchema, confirmEstimatedExpenseSchema, creditCardInvoiceSchema, estimatedExpenseSchema, transactionSchema } from "./validations";

// BL-025: toda data sem hora sai do schema como meia-noite UTC do dia.
describe("datas sem hora nos schemas", () => {
    const base = {
        descricao: "Aluguel", valor: 100, status: "PENDENTE", tipo: "SAIDA",
        categoria_id: "c", tipo_pagamento_id: "p", institution_id: "i",
    } as const;

    test("data escolhida no calendário (meia-noite em Brasília) vira meia-noite UTC do mesmo dia", () => {
        const parsed = transactionSchema.parse({ ...base, data_vencimento: new Date(2026, 9, 6) });
        expect(parsed.data_vencimento.toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("lançamento criado às 22h de Brasília fica no dia de Brasília", () => {
        const parsed = transactionSchema.parse({ ...base, data_vencimento: new Date("2026-10-07T01:00:00Z") });
        expect(parsed.data_vencimento.toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("fatura importada: vencimento e data da compra em texto", () => {
        const parsed = creditCardInvoiceSchema.parse({
            descricao: "Fatura", data_vencimento: "2026-10-08", institution_id: "i", tipo_pagamento_id: "p",
            items: [{ descricao: "Mercado", valor: 10, categoria_id: "c", data_compra: "2026-09-01" }],
        });
        expect(parsed.data_vencimento.toISOString()).toBe("2026-10-08T00:00:00.000Z");
        expect(parsed.items[0].data_compra.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    });

    test("compra parcelada e confirmação de despesa prevista", () => {
        const purchase = cardInstallmentPurchaseSchema.parse({
            credit_card_id: "k", descricao: "Geladeira", valor: 500, data_compra: new Date(2026, 9, 5), installmentsCount: 5, categoria_id: "c",
        });
        expect(purchase.data_compra.toISOString()).toBe("2026-10-05T00:00:00.000Z");
        const confirm = confirmEstimatedExpenseSchema.parse({ valor: 10, data_vencimento: new Date(2026, 9, 1) });
        expect(confirm.data_vencimento?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });

    test("data inválida é rejeitada", () => {
        expect(transactionSchema.safeParse({ ...base, data_vencimento: "abc" }).success).toBe(false);
    });
});

// BL-030: despesa prevista recorrente (mesmo valor repetido por N meses).
describe("estimatedExpenseSchema: recorrente", () => {
    const base = { descricao: "academia", valor: 120, categoria_id: "c", invoice_month: 11, invoice_year: 2026, credit_card_id: "k" };

    test("aceita recorrente de 2 a 36 meses", () => {
        expect(estimatedExpenseSchema.parse({ ...base, isRecurring: true, recurringMonths: 12 }).recurringMonths).toBe(12);
        expect(estimatedExpenseSchema.safeParse({ ...base, isRecurring: true, recurringMonths: 36 }).success).toBe(true);
    });

    test("recusa fora do intervalo ou sem a quantidade de meses", () => {
        expect(estimatedExpenseSchema.safeParse({ ...base, isRecurring: true, recurringMonths: 1 }).success).toBe(false);
        expect(estimatedExpenseSchema.safeParse({ ...base, isRecurring: true, recurringMonths: 37 }).success).toBe(false);
        expect(estimatedExpenseSchema.safeParse({ ...base, isRecurring: true }).success).toBe(false);
    });

    test("não pode ser parcelada e recorrente ao mesmo tempo", () => {
        const r = estimatedExpenseSchema.safeParse({ ...base, isRecurring: true, recurringMonths: 6, isInstallment: true, installmentsCount: 3 });
        expect(r.success).toBe(false);
    });

    test("sem os campos novos continua valendo como antes (uma vez)", () => {
        const parsed = estimatedExpenseSchema.parse(base);
        expect([parsed.isRecurring, parsed.isInstallment]).toEqual([false, false]);
    });
});