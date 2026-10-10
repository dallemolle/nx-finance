import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-028: em /faturas, selecionar lançamentos previstos de vários meses e
// excluí-los de uma vez; itens confirmados (fatura real) não são afetados.
test("exclui em lote os lançamentos previstos selecionados em /faturas", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const card = await db.creditCard.findFirstOrThrow({ where: { userId: user.id, nome: E2E_USER.cardName } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });

        // 3 faturas previstas (próximos 3 meses), uma parcela de "Sofá" em cada
        const now = new Date();
        for (let i = 1; i <= 3; i++) {
            const due = new Date(now.getFullYear(), now.getMonth() + i, 8);
            await db.transaction.create({
                data: {
                    descricao: `Fatura Prevista - ${card.nome}`, valor: 250, data_vencimento: due,
                    status: "PENDENTE", tipo: "SAIDA", is_invoice_header: true, is_provisioned: true,
                    userId: user.id, credit_card_id: card.id, invoice_month: due.getMonth() + 1, invoice_year: due.getFullYear(),
                    categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: card.institution_id,
                    invoiceItems: {
                        create: {
                            descricao: `Sofá (0${i}/03)`, valor: 250, data_compra: now, categoria_id: category.id,
                            is_provisioned: true, installment_number: i, installment_total: 3,
                        },
                    },
                },
            });
        }
        const confirmedBefore = await db.creditCardInvoiceItem.count({ where: { is_provisioned: false, transaction: { userId: user.id } } });

        await login(page);
        await page.goto("/faturas");
        await page.getByRole("button", { name: "Ver meses" }).click();
        await page.getByRole("button", { name: /Selecionar todos os previstos/ }).click();

        const bar = page.getByRole("region", { name: "Lançamentos previstos selecionados" });
        await expect(bar).toBeVisible();
        await expect(page.getByRole("checkbox", { name: "Selecionar Sofá (02/03) para excluir" })).toBeChecked();

        page.once("dialog", d => d.accept());
        await bar.getByRole("button", { name: "Excluir selecionados" }).click();
        await expect(bar).toBeHidden();
        await expect(page.getByText("Sofá (02/03)")).toBeHidden();

        expect(await db.creditCardInvoiceItem.count({ where: { is_provisioned: true, transaction: { userId: user.id } } })).toBe(0);
        expect(await db.transaction.count({ where: { userId: user.id, is_provisioned: true, is_invoice_header: true } })).toBe(0);
        expect(await db.creditCardInvoiceItem.count({ where: { is_provisioned: false, transaction: { userId: user.id } } })).toBe(confirmedBefore);
    } finally {
        await db.$disconnect();
    }
});
