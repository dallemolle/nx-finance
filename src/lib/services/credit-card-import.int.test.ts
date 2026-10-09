import { describe, expect, test } from "vitest";
import { addMonths } from "date-fns";
import { db } from "@/lib/db";
import { findPossibleDuplicateInstallmentsForUser, importCreditCardInvoiceForUser } from "./credit-card-import";
import { getInvoiceTimelineDetailForUser, provisionCardInstallmentPurchaseForUser } from "./credit-card-provision";
import { createUserWithCard, type Scenario } from "../../../test/fixtures";
import type { CreditCardInvoiceInput } from "@/lib/validations";

type Item = CreditCardInvoiceInput["items"][number];

function importInvoice(s: Scenario, dueDate: Date, items: Partial<Item>[]) {
    return importCreditCardInvoiceForUser(s.user.id, {
        descricao: "Fatura teste",
        data_vencimento: dueDate,
        institution_id: s.institution.id,
        tipo_pagamento_id: s.paymentMethod.id,
        credit_card_id: s.card.id,
        items: items.map(i => ({
            descricao: "Compra",
            valor: 10,
            categoria_id: s.category.id,
            data_compra: new Date(2026, 6, 27),
            isInstallment: false,
            ...i,
        })) as Item[],
    });
}

const provisionedHeaders = (s: Scenario) => db.transaction.findMany({
    where: { userId: s.user.id, credit_card_id: s.card.id, is_invoice_header: true, is_provisioned: true },
    include: { invoiceItems: true },
    orderBy: [{ invoice_year: "asc" }, { invoice_month: "asc" }],
});

describe("importCreditCardInvoiceForUser", () => {
    test("soma itens (estornos reduzem o total) e vincula a fatura ao ciclo do cartão", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });

        const { transaction, itemsCount } = await importInvoice(s, new Date(2026, 8, 5), [
            { descricao: "Mercado", valor: 200 },
            { descricao: "Estorno", valor: -50 },
        ]);

        expect(itemsCount).toBe(2);
        const header = await db.transaction.findUniqueOrThrow({ where: { id: transaction.id } });
        expect(Number(header.valor)).toBe(150);
        // vencimento 05/09 com fecha 25 / vence 5 -> ciclo de agosto
        expect({ month: header.invoice_month, year: header.invoice_year }).toEqual({ month: 8, year: 2026 });
    });

    test("recusa fatura cujo total não é positivo", async () => {
        const s = await createUserWithCard();

        await expect(importInvoice(s, new Date(2026, 8, 5), [{ valor: 50 }, { valor: -80 }])).rejects.toThrow(/maior que zero/);
        expect(await db.transaction.count()).toBe(0);
    });

    test("item marcado como parcela N/M é carimbado e projeta as parcelas seguintes com o mesmo valor", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });

        const { transaction } = await importInvoice(s, new Date(2026, 8, 5), [
            { descricao: "Notebook", valor: 150, isInstallment: true, installmentNumber: 2, installmentsCount: 4 },
        ]);

        const [imported] = await db.creditCardInvoiceItem.findMany({ where: { transactionId: transaction.id } });
        expect({ number: imported.installment_number, total: imported.installment_total }).toEqual({ number: 2, total: 4 });
        expect(imported.installment_group_id).not.toBeNull();

        const future = await provisionedHeaders(s);
        expect(future.map(h => h.invoice_month)).toEqual([9, 10]);
        expect(future.map(h => Number(h.valor))).toEqual([150, 150]);
        expect(future.flatMap(h => h.invoiceItems.map(i => [i.installment_number, i.installment_group_id]))).toEqual([
            [3, imported.installment_group_id],
            [4, imported.installment_group_id],
        ]);
    });

    test("última parcela (N/N) é carimbada sem projetar nada", async () => {
        const s = await createUserWithCard();

        const { transaction } = await importInvoice(s, new Date(2026, 8, 5), [
            { descricao: "Mouse", valor: 40, isInstallment: true, installmentNumber: 4, installmentsCount: 4 },
        ]);

        const [imported] = await db.creditCardInvoiceItem.findMany({ where: { transactionId: transaction.id } });
        expect({ number: imported.installment_number, total: imported.installment_total }).toEqual({ number: 4, total: 4 });
        expect(await provisionedHeaders(s)).toEqual([]);
    });

    test("importar a fatura real do mês seguinte substitui a prevista daquele mês, sem duplicar a parcela (BL-026)", async () => {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 5 });
        await importInvoice(s, new Date(2026, 8, 5), [
            { descricao: "Notebook", valor: 150, isInstallment: true, installmentNumber: 2, installmentsCount: 4 },
        ]);

        // fatura real de setembro (vence 05/10): o extrato já traz a parcela 3/4
        const { transaction: september } = await importInvoice(s, new Date(2026, 9, 5), [
            { descricao: "Farmácia", valor: 30 },
            { descricao: "Notebook - Parcela 3/4", valor: 150 },
        ]);

        const sept = await db.transaction.findUniqueOrThrow({ where: { id: september.id }, include: { invoiceItems: true } });
        expect(Number(sept.valor)).toBe(180);
        expect(sept.invoiceItems.map(i => i.descricao).sort()).toEqual(["Farmácia", "Notebook - Parcela 3/4"]);
        expect((await provisionedHeaders(s)).map(h => h.invoice_month)).toEqual([10]);
    });

    test("cenário de produção: compra parcelada lançada antes não duplica na fatura importada (BL-026)", async () => {
        // Nubank: fecha 31, vence 8. Compra de 5x R$ 100 lançada em julho pela "Compra Parcelada".
        const s = await createUserWithCard({ closingDay: 31, dueDay: 8 });
        await provisionCardInstallmentPurchaseForUser(s.user.id, {
            credit_card_id: s.card.id, descricao: "geladeira", valor: 500,
            data_compra: new Date(2026, 6, 10), installmentsCount: 5, categoria_id: s.category.id,
        });
        const before = await provisionedHeaders(s);
        const octoberDue = before.find(h => h.invoice_month === 9)!;
        const novemberDue = before.find(h => h.invoice_month === 10)!;

        // Fatura de setembro, vence 08/10; o CSV do Nubank já traz a parcela 3/5
        const { transaction } = await importInvoice(s, new Date(2026, 9, 8), [
            { descricao: "Mercado", valor: 200, data_compra: new Date(2026, 8, 5) },
            { descricao: "Geladeira - Parcela 3/5", valor: 100, data_compra: new Date(2026, 6, 10) },
        ]);

        const real = await db.transaction.findUniqueOrThrow({ where: { id: transaction.id }, include: { invoiceItems: true } });
        expect(Number(real.valor)).toBe(300);
        expect(real.invoiceItems.map(i => i.descricao).sort()).toEqual(["Geladeira - Parcela 3/5", "Mercado"]);
        // a prevista que vencia em 08/10 foi substituída; a de novembro segue intacta
        expect(await db.transaction.findUnique({ where: { id: octoberDue.id } })).toBeNull();
        const novemberAfter = await db.transaction.findUniqueOrThrow({ where: { id: novemberDue.id }, include: { invoiceItems: true } });
        expect(novemberAfter.invoiceItems.map(i => i.descricao)).toEqual(["Geladeira (04/05)"]);
        expect(Number(novemberAfter.valor)).toBe(100);
    });

    test("parcela projetada aparece no mês calendário do vencimento, com descrição sem o número do banco", async () => {
        // fecha 25 / vence 10: o ciclo (invoice_month) fica 1 mês atrás do vencimento
        const s = await createUserWithCard({ closingDay: 25, dueDay: 10 });
        const now = new Date();
        const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), 10);

        await importInvoice(s, dueThisMonth, [
            { descricao: "Compra Loja - Parcela 1/3", valor: 150, isInstallment: true, installmentNumber: 1, installmentsCount: 3 },
        ]);

        const future = await provisionedHeaders(s);
        const next = addMonths(dueThisMonth, 1);
        const mm = String(next.getMonth() + 1).padStart(2, "0");
        expect(future[0].descricao).toBe(`Fatura Prevista - Cartão Teste - ${mm}/${next.getFullYear()}`);
        expect(future[0].invoiceItems[0].descricao).toBe("Compra Loja (02/03)");

        const [group] = await getInvoiceTimelineDetailForUser(s.user.id);
        const itemsByMonth = group.months.map(m => m.items.map(i => i.installment_number));
        expect(itemsByMonth.slice(0, 3)).toEqual([[1], [2], [3]]);
    });
});

describe("findPossibleDuplicateInstallmentsForUser", () => {
    async function withImportedFirstInstallment() {
        const s = await createUserWithCard({ closingDay: 25, dueDay: 10 });
        await importInvoice(s, new Date(2026, 6, 10), [
            { descricao: "Pb*Coffee Mais - Parcela 1/3", valor: 50, isInstallment: true, installmentNumber: 1, installmentsCount: 3 },
        ]);
        return s;
    }

    test("avisa quando parcela posterior do mesmo estabelecimento e total já existe", async () => {
        const s = await withImportedFirstInstallment();

        const matches = await findPossibleDuplicateInstallmentsForUser(s.user.id, s.card.id, [
            { idx: 0, descricao: "Pb*Coffee Mais - Parcela 2/3", installmentNumber: 2, installmentsCount: 3 },
        ]);

        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({ idx: 0, matchDescricao: "Pb*Coffee Mais - Parcela 1/3" });
    });

    test.each([
        ["total de parcelas diferente", "Pb*Coffee Mais - Parcela 2/5", 2, 5],
        ["estabelecimento diferente", "Amazon BR V - Parcela 2/3", 2, 3],
        ["parcela 1 nunca é candidata", "Pb*Coffee Mais - Parcela 1/3", 1, 3],
    ])("não avisa: %s", async (_, descricao, installmentNumber, installmentsCount) => {
        const s = await withImportedFirstInstallment();

        expect(await findPossibleDuplicateInstallmentsForUser(s.user.id, s.card.id, [
            { idx: 0, descricao, installmentNumber, installmentsCount },
        ])).toEqual([]);
    });

    test("não considera parcelas de outro usuário", async () => {
        const owner = await withImportedFirstInstallment();
        const other = await createUserWithCard();

        expect(await findPossibleDuplicateInstallmentsForUser(other.user.id, owner.card.id, [
            { idx: 0, descricao: "Pb*Coffee Mais - Parcela 2/3", installmentNumber: 2, installmentsCount: 3 },
        ])).toEqual([]);
    });
});
