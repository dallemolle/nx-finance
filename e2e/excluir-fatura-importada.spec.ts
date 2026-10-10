import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-029: apagar pelo dashboard uma fatura importada errada (e os itens
// dela), sem afetar as faturas previstas.
test("exclui uma fatura importada pela lixeira em Lançamentos do Mês", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const card = await db.creditCard.findFirstOrThrow({ where: { userId: user.id, nome: E2E_USER.cardName } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const now = new Date();
        const header = (provisioned: boolean, descricao: string, due: Date) => ({
            descricao, valor: 0, data_vencimento: due, status: "PENDENTE" as const, tipo: "SAIDA" as const,
            is_invoice_header: true, is_provisioned: provisioned, userId: user.id, credit_card_id: card.id,
            invoice_month: due.getMonth() + 1, invoice_year: due.getFullYear(),
            categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: card.institution_id,
        });

        const invoice = await db.transaction.create({
            data: {
                ...header(false, "Fatura para excluir", new Date(now.getFullYear(), now.getMonth(), 15)),
                valor: 300,
                invoiceItems: {
                    create: [
                        { descricao: "Mercado", valor: 200, data_compra: now, categoria_id: category.id },
                        { descricao: "Farmácia", valor: 100, data_compra: now, categoria_id: category.id },
                    ],
                },
            },
        });
        await db.transaction.create({
            data: {
                ...header(true, "Fatura Prevista - mês que vem", new Date(now.getFullYear(), now.getMonth() + 1, 15)),
                valor: 90,
                invoiceItems: { create: { descricao: "Curso (02/03)", valor: 90, data_compra: now, categoria_id: category.id, is_provisioned: true } },
            },
        });
        const provisionedBefore = await db.creditCardInvoiceItem.count({ where: { is_provisioned: true, transaction: { userId: user.id } } });

        await login(page);
        await expect(page.getByText("Fatura para excluir")).toBeVisible();

        let confirmMessage = "";
        page.once("dialog", d => { confirmMessage = d.message(); d.accept(); });
        await page.getByRole("button", { name: "Excluir fatura importada Fatura para excluir" }).click();

        await expect(page.getByText("Fatura para excluir")).toBeHidden();
        expect(confirmMessage).toContain("2 itens");
        expect(await db.transaction.findUnique({ where: { id: invoice.id } })).toBeNull();
        expect(await db.creditCardInvoiceItem.count({ where: { transactionId: invoice.id } })).toBe(0);
        expect(await db.creditCardInvoiceItem.count({ where: { is_provisioned: true, transaction: { userId: user.id } } })).toBe(provisionedBefore);
    } finally {
        await db.$disconnect();
    }
});
