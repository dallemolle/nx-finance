import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import {
    confirmEstimatedExpenseForUser,
    provisionCardInstallmentPurchaseForUser,
    reconcileProvisionedInstallments,
} from "./credit-card-provision";
import { createUserWithCard, invoiceHeaderData, type Scenario } from "../../../test/fixtures";

function genericEstimate(s: Scenario, valor: number) {
    return db.transaction.create({
        data: {
            descricao: "Conta de luz (estimativa)",
            valor,
            data_vencimento: new Date(2026, 8, 1),
            status: "PENDENTE",
            tipo: "SAIDA",
            is_provisioned: true,
            userId: s.user.id,
            categoria_id: s.category.id,
            tipo_pagamento_id: s.paymentMethod.id,
            institution_id: s.institution.id,
        },
    });
}

describe("confirmEstimatedExpenseForUser", () => {
    test("efetiva despesa prevista genérica com o valor real", async () => {
        const s = await createUserWithCard();
        const estimate = await genericEstimate(s, 150);

        const confirmed = await confirmEstimatedExpenseForUser(s.user.id, estimate.id, { valor: 187 });

        expect(confirmed.is_provisioned).toBe(false);
        expect(Number(confirmed.valor)).toBe(187);
        expect(confirmed.descricao).toBe("Conta de luz (estimativa)");
    });

    test("rejeita despesa prevista vinculada a cartão (fatura projetada)", async () => {
        const s = await createUserWithCard();
        const cardHeader = await db.transaction.create({
            data: invoiceHeaderData(s, { invoiceMonth: 9, invoiceYear: 2026, dueDate: new Date(2026, 9, 5), provisioned: true, valor: 100 }),
        });

        await expect(confirmEstimatedExpenseForUser(s.user.id, cardHeader.id, { valor: 100 })).rejects.toThrow(/não encontrada/);
        expect((await db.transaction.findUniqueOrThrow({ where: { id: cardHeader.id } })).is_provisioned).toBe(true);
    });

    test("rejeita despesa prevista de outro usuário", async () => {
        const owner = await createUserWithCard();
        const intruder = await createUserWithCard();
        const estimate = await genericEstimate(owner, 150);

        await expect(confirmEstimatedExpenseForUser(intruder.user.id, estimate.id, { valor: 1 })).rejects.toThrow(/não encontrada/);
        expect(Number((await db.transaction.findUniqueOrThrow({ where: { id: estimate.id } })).valor)).toBe(150);
    });
});

describe("provisionCardInstallmentPurchaseForUser", () => {
    test("compra parcelada gera uma fatura prevista por parcela, a partir do ciclo da compra", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });

        // 27/07 >= fechamento 25 -> primeira parcela na fatura de agosto
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: s.card.id,
            descricao: "notebook",
            valor: 300,
            data_compra: new Date(2026, 6, 27),
            installmentsCount: 3,
            categoria_id: s.category.id,
        });

        const headers = await db.transaction.findMany({
            where: { userId: s.user.id, credit_card_id: s.card.id, is_invoice_header: true, is_provisioned: true },
            include: { invoiceItems: true },
            orderBy: [{ invoice_year: "asc" }, { invoice_month: "asc" }],
        });
        expect(headers.map(h => h.invoice_month)).toEqual([8, 9, 10]);
        expect(headers.reduce((sum, h) => sum + Number(h.valor), 0)).toBeCloseTo(300, 2);
        expect(headers.flatMap(h => h.invoiceItems.map(i => i.descricao))).toEqual([
            "Notebook (01/03)",
            "Notebook (02/03)",
            "Notebook (03/03)",
        ]);
        // vencimento no mês seguinte ao ciclo (dueDay 5 <= closingDay 25)
        expect(headers[0].data_vencimento).toEqual(new Date(2026, 8, 5));
    });

    test("não provisiona em cartão de outro usuário", async () => {
        const owner = await createUserWithCard();
        const intruder = await createUserWithCard();

        await expect(provisionCardInstallmentPurchaseForUser(intruder.user.id, {
            credit_card_id: owner.card.id,
            descricao: "x",
            valor: 100,
            data_compra: new Date(2026, 6, 27),
            installmentsCount: 2,
            categoria_id: intruder.category.id,
        })).rejects.toThrow(/Cartão não encontrado/);
        expect(await db.transaction.count()).toBe(0);
    });
});

describe("reconcileProvisionedInstallments", () => {
    test("fatura real importada absorve as parcelas previstas do mesmo ciclo", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: s.card.id,
            descricao: "notebook",
            valor: 300,
            data_compra: new Date(2026, 6, 27),
            installmentsCount: 3,
            categoria_id: s.category.id,
        });
        const augustProvisioned = await db.transaction.findFirstOrThrow({
            where: { userId: s.user.id, is_provisioned: true, invoice_month: 8, invoice_year: 2026 },
        });

        // chega a fatura real de agosto com 1 compra avulsa de R$ 50
        const real = await db.transaction.create({
            data: invoiceHeaderData(s, { invoiceMonth: 8, invoiceYear: 2026, dueDate: new Date(2026, 8, 5), provisioned: false, valor: 50 }),
        });
        await db.creditCardInvoiceItem.create({
            data: { transactionId: real.id, descricao: "Mercado", valor: 50, data_compra: new Date(2026, 7, 10), categoria_id: s.category.id },
        });

        const result = await db.$transaction(tx => reconcileProvisionedInstallments(tx, {
            userId: s.user.id, creditCardId: s.card.id, invoiceMonth: 8, invoiceYear: 2026, newHeaderId: real.id,
        }));

        expect(result).toEqual({ carriedCount: 1, carriedTotal: 100 });
        expect(await db.transaction.findUnique({ where: { id: augustProvisioned.id } })).toBeNull();

        const realAfter = await db.transaction.findUniqueOrThrow({ where: { id: real.id }, include: { invoiceItems: true } });
        expect(Number(realAfter.valor)).toBe(150);
        expect(realAfter.invoiceItems).toHaveLength(2);
        expect(realAfter.invoiceItems.every(i => !i.is_provisioned)).toBe(true);

        // setembro continua previsto
        expect(await db.transaction.count({ where: { userId: s.user.id, is_provisioned: true, invoice_month: 9 } })).toBe(1);
    });
});
