import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-044: no build de produção (o CI roda os e2e com next build), erro lançado
// por Server Action chegava à tela como "Minified React error #441". A regra
// do app tem que aparecer com a mensagem dela.
test("excluir categoria com lançamentos mostra o motivo, não um erro genérico", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Mercado" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const institution = await db.financialInstitution.findFirstOrThrow({ where: { userId: user.id } });
        await db.transaction.create({
            data: {
                descricao: "Feira", valor: 80, data_vencimento: new Date(), status: "PENDENTE", tipo: "SAIDA",
                userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
            },
        });

        await login(page);
        await page.goto("/dashboard/settings");
        await page.getByRole("tab", { name: "Categorias" }).click();
        page.once("dialog", d => d.accept());
        await page.getByRole("button", { name: "Excluir Mercado" }).click();

        await expect(page.getByText(/Não é possível excluir\. Existem \d+ transações vinculadas a esta categoria\./)).toBeVisible();
        await expect(page.getByText(/Minified React error/)).toHaveCount(0);
        expect(await db.category.count({ where: { id: category.id } })).toBe(1);
    } finally {
        await db.$disconnect();
    }
});
