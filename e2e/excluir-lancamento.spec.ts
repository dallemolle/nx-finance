import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-038: lançamento de "Nova Transação" pendente tem lixeira (ex.: lançado em
// duplicidade); pago não tem — precisa voltar para Pendente antes.
test("exclui lançamento pendente duplicado; pago fica sem lixeira", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const institution = await db.financialInstitution.findFirstOrThrow({ where: { userId: user.id } });
        const now = new Date();
        const row = (descricao: string, day: number, paid = false) => ({
            descricao, valor: 1500, data_vencimento: new Date(Date.UTC(now.getFullYear(), now.getMonth(), day)),
            status: paid ? "PAGO" as const : "PENDENTE" as const, data_pagamento: paid ? now : null, tipo: "SAIDA" as const,
            userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        });
        await Promise.all([
            db.transaction.create({ data: row("Aluguel duplicado", 10) }),
            db.transaction.create({ data: row("Aluguel duplicado", 11) }),
            db.transaction.create({ data: row("Condomínio pago", 12, true) }),
        ]);

        await login(page);
        const deleteButtons = page.getByRole("button", { name: "Excluir lançamento Aluguel duplicado" });
        await expect(deleteButtons).toHaveCount(2);
        await expect(page.getByText("Condomínio pago")).toBeVisible();
        await expect(page.getByRole("button", { name: "Excluir lançamento Condomínio pago" })).toHaveCount(0);

        let confirmMessage = "";
        page.once("dialog", d => { confirmMessage = d.message(); d.accept(); });
        await deleteButtons.first().click();

        await expect(deleteButtons).toHaveCount(1);
        expect(confirmMessage).toContain("Aluguel duplicado");
        expect(await db.transaction.count({ where: { userId: user.id, descricao: "Aluguel duplicado" } })).toBe(1);
        expect(await db.transaction.count({ where: { userId: user.id, descricao: "Condomínio pago" } })).toBe(1);
    } finally {
        await db.$disconnect();
    }
});
