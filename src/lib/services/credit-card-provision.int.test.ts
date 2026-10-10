import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import {
    confirmEstimatedExpenseForUser,
    deleteProvisionedInvoiceItemsForUser,
    provisionCardInstallmentPurchaseForUser,
    replaceProvisionedInvoice,
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

describe("replaceProvisionedInvoice (BL-026)", () => {
    test("apaga a fatura prevista do mesmo cartão e ciclo, inteira, sem mexer nas outras", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: s.card.id,
            descricao: "notebook",
            valor: 300,
            data_compra: new Date(2026, 6, 27),
            installmentsCount: 3,
            categoria_id: s.category.id,
        });
        const august = await db.transaction.findFirstOrThrow({
            where: { userId: s.user.id, is_provisioned: true, invoice_month: 8, invoice_year: 2026 },
        });
        // uma estimativa avulsa (sem parcelamento) na mesma fatura prevista também sai
        await db.creditCardInvoiceItem.create({
            data: { transactionId: august.id, descricao: "Mercado (estimativa)", valor: 400, data_compra: new Date(2026, 7, 1), categoria_id: s.category.id, is_provisioned: true },
        });

        const result = await db.$transaction(tx => replaceProvisionedInvoice(tx, {
            userId: s.user.id, creditCardId: s.card.id, invoiceMonth: 8, invoiceYear: 2026,
        }));

        expect(result).toEqual({ removedCount: 2, removedTotal: 500 });
        expect(await db.transaction.findUnique({ where: { id: august.id } })).toBeNull();
        expect(await db.creditCardInvoiceItem.count({ where: { transactionId: august.id } })).toBe(0);
        // setembro e outubro continuam previstos
        expect((await db.transaction.findMany({
            where: { userId: s.user.id, is_provisioned: true },
            orderBy: { invoice_month: "asc" },
        })).map(h => h.invoice_month)).toEqual([9, 10]);
    });

    test("não toca na fatura prevista de outro cartão", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });
        const otherCard = await db.creditCard.create({
            data: { nome: "Outro", closingDay: 25, dueDay: 5, institution_id: s.institution.id, userId: s.user.id },
        });
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: otherCard.id, descricao: "tv", valor: 200,
            data_compra: new Date(2026, 6, 27), installmentsCount: 2, categoria_id: s.category.id,
        });

        const result = await db.$transaction(tx => replaceProvisionedInvoice(tx, {
            userId: s.user.id, creditCardId: s.card.id, invoiceMonth: 8, invoiceYear: 2026,
        }));

        expect(result).toEqual({ removedCount: 0, removedTotal: 0 });
        expect(await db.transaction.count({ where: { credit_card_id: otherCard.id, is_provisioned: true } })).toBe(2);
    });
});

describe("deleteProvisionedInvoiceItemsForUser (BL-028)", () => {
    async function withFiveInstallments() {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: s.card.id, descricao: "geladeira", valor: 500,
            data_compra: new Date(2026, 6, 27), installmentsCount: 5, categoria_id: s.category.id,
        });
        const headers = await db.transaction.findMany({
            where: { userId: s.user.id, is_provisioned: true },
            include: { invoiceItems: true },
            orderBy: [{ invoice_year: "asc" }, { invoice_month: "asc" }],
        });
        return { s, headers };
    }

    test("exclui itens previstos de vários meses e remove as faturas previstas que ficam vazias", async () => {
        const { s, headers } = await withFiveInstallments();
        // um segundo item no 1º mês, pra conferir que a fatura não some e o valor é recalculado
        await db.creditCardInvoiceItem.create({
            data: { transactionId: headers[0].id, descricao: "Mercado (estimativa)", valor: 80, data_compra: new Date(2026, 7, 1), categoria_id: s.category.id, is_provisioned: true },
        });
        const ids = headers.map(h => h.invoiceItems[0].id); // as 5 parcelas

        const result = await deleteProvisionedInvoiceItemsForUser(s.user.id, ids);

        expect(result).toEqual({ deletedCount: 5 });
        const remaining = await db.transaction.findMany({ where: { userId: s.user.id, is_provisioned: true }, include: { invoiceItems: true } });
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(headers[0].id);
        expect(remaining[0].invoiceItems.map(i => i.descricao)).toEqual(["Mercado (estimativa)"]);
        expect(Number(remaining[0].valor)).toBe(80);
    });

    test("não exclui itens de fatura real nem de outro usuário", async () => {
        const { s, headers } = await withFiveInstallments();
        const other = await createUserWithCard();
        const real = await db.transaction.create({
            data: invoiceHeaderData(s, { invoiceMonth: 7, invoiceYear: 2026, dueDate: new Date(2026, 7, 5), provisioned: false, valor: 50 }),
        });
        const realItem = await db.creditCardInvoiceItem.create({
            data: { transactionId: real.id, descricao: "Mercado", valor: 50, data_compra: new Date(2026, 6, 10), categoria_id: s.category.id },
        });

        const result = await deleteProvisionedInvoiceItemsForUser(other.user.id, [headers[0].invoiceItems[0].id]);
        expect(result).toEqual({ deletedCount: 0 });

        const own = await deleteProvisionedInvoiceItemsForUser(s.user.id, [realItem.id]);
        expect(own).toEqual({ deletedCount: 0 });
        expect(await db.creditCardInvoiceItem.count({ where: { id: { in: [realItem.id, headers[0].invoiceItems[0].id] } } })).toBe(2);
    });

    test("lista vazia não faz nada", async () => {
        const { s } = await withFiveInstallments();
        expect(await deleteProvisionedInvoiceItemsForUser(s.user.id, [])).toEqual({ deletedCount: 0 });
        expect(await db.creditCardInvoiceItem.count({ where: { is_provisioned: true } })).toBe(5);
    });
});
