import { expect, test, type Page } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-012: cada diálogo tem descrição (sem o aviso do Radix no console) e cada
// campo é encontrado pelo rótulo — o que também é o que um leitor de tela anuncia.
const DIALOGS: { open: string; fields: string[] }[] = [
    {
        open: "Nova Transação",
        fields: ["Tipo", "Status", "Descrição Geral", "Valor Total (R$)", "Data de Vencimento", "Instituição Financeira", "Categoria", "Meio de Pagamento", "Despesa Parcelada?"],
    },
    { open: "Importar CSV", fields: ["Arquivo CSV do extrato", "Instituição Financeira", "Data de Vencimento do Lote", "Meio de Pagamento"] },
    { open: "Compra Parcelada", fields: ["Cartão", "Data da Compra", "Categoria"] },
    { open: "Despesa Prevista", fields: ["Categoria", "Mês", "Ano"] },
    { open: "Editar Conta de luz", fields: ["Tipo", "Status", "Descrição Geral", "Data de Vencimento", "Instituição Financeira", "Categoria", "Meio de Pagamento"] },
];

async function checkDialog(page: Page, fields: string[]) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(/\S/);
    for (const field of fields) {
        await expect(dialog.getByLabel(field, { exact: true }), `campo "${field}"`).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
}

test("diálogos com descrição e campos ligados aos rótulos", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const card = await db.creditCard.findFirstOrThrow({ where: { userId: user.id, nome: E2E_USER.cardName } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const now = new Date();
        await db.transaction.create({
            data: {
                descricao: "Conta de luz", valor: 180, data_vencimento: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 15)),
                status: "PENDENTE", tipo: "SAIDA", userId: user.id, categoria_id: category.id,
                tipo_pagamento_id: paymentMethod.id, institution_id: card.institution_id,
            },
        });
    } finally {
        await db.$disconnect();
    }

    const warnings: string[] = [];
    page.on("console", msg => {
        if (/Description|aria-describedby/.test(msg.text())) warnings.push(msg.text());
    });

    await login(page);
    for (const { open, fields } of DIALOGS) {
        await page.getByRole("button", { name: open }).first().click();
        await checkDialog(page, fields);
    }

    expect(warnings).toEqual([]);
});
