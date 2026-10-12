import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-030: despesa prevista recorrente pela tela — o mesmo valor, cheio, em
// cada um dos meses, na fatura prevista do cartão.
test("cria uma despesa prevista recorrente no cartão por 3 meses", async ({ page }) => {
    // Dashboard vazio não mostra a linha do tempo (onde fica "Despesa Prevista").
    const seed = e2eDb();
    try {
        const user = await seed.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const card = await seed.creditCard.findFirstOrThrow({ where: { userId: user.id, nome: E2E_USER.cardName } });
        const category = await seed.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await seed.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const now = new Date();
        await seed.transaction.create({
            data: {
                descricao: "Conta de água", valor: 90, data_vencimento: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 12)),
                status: "PENDENTE", tipo: "SAIDA", userId: user.id, categoria_id: category.id,
                tipo_pagamento_id: paymentMethod.id, institution_id: card.institution_id,
            },
        });
    } finally {
        await seed.$disconnect();
    }

    await login(page);
    await page.getByRole("button", { name: "Despesa Prevista" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Descrição").fill("Streaming E2E");
    await dialog.getByLabel("Valor Estimado (R$)").fill("39.90");
    await dialog.getByLabel("Categoria").click();
    await page.getByRole("button", { name: "Compras", exact: true }).click();
    await dialog.getByLabel("Cartão", { exact: true }).click();
    await page.getByRole("button", { name: E2E_USER.cardName, exact: true }).click();

    await dialog.getByRole("button", { name: "Recorrente" }).click();
    await expect(dialog.getByRole("button", { name: "Recorrente" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Repetir por quantos meses").fill("3");
    await expect(dialog.getByText("Total no período: R$ 119,70")).toBeVisible();
    await expect(dialog.locator("tbody tr")).toHaveCount(3);

    await dialog.getByRole("button", { name: "Lançar Despesa Prevista" }).click();
    await expect(dialog).toBeHidden();

    const db = e2eDb();
    try {
        const items = await db.creditCardInvoiceItem.findMany({
            where: { descricao: "Streaming e2e", transaction: { creditCard: { nome: E2E_USER.cardName } } },
            include: { transaction: true },
            orderBy: { transaction: { data_vencimento: "asc" } },
        });
        expect(items.map(i => [Number(i.valor), i.is_provisioned, i.installment_total])).toEqual([
            [39.9, true, null],
            [39.9, true, null],
            [39.9, true, null],
        ]);
        expect(new Set(items.map(i => `${i.transaction.invoice_year}-${i.transaction.invoice_month}`)).size).toBe(3);
    } finally {
        await db.$disconnect();
    }
});
