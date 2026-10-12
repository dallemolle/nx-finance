import { describe, expect, test } from "vitest";
import { cardInstallmentPurchaseSchema, confirmEstimatedExpenseSchema, creditCardInvoiceSchema, transactionSchema } from "./validations";

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
