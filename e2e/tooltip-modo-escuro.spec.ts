import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// Luminância relativa (WCAG) de "rgb(r, g, b)".
function luminance(rgb: string): number {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// BL-041: no modo escuro, as linhas "Confirmado"/"Previsto" do tooltip da
// linha do tempo de faturas saíam em preto sobre o fundo escuro.
test.use({ colorScheme: "dark" });

test("tooltip da linha do tempo de faturas legível no modo escuro", async ({ page }) => {
    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const card = await db.creditCard.findFirstOrThrow({ where: { userId: user.id, nome: E2E_USER.cardName } });
        const category = await db.category.findFirstOrThrow({ where: { userId: user.id, nome: "Compras" } });
        const paymentMethod = await db.paymentMethod.findFirstOrThrow({ where: { userId: user.id } });
        const now = new Date();
        const due = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 15));
        await db.transaction.create({
            data: {
                descricao: "Fatura tooltip", valor: 300, data_vencimento: due, status: "PENDENTE", tipo: "SAIDA",
                is_invoice_header: true, userId: user.id, credit_card_id: card.id,
                invoice_month: due.getUTCMonth() + 1, invoice_year: due.getUTCFullYear(),
                categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: card.institution_id,
                invoiceItems: { create: { descricao: "Mercado", valor: 300, data_compra: now, categoria_id: category.id } },
            },
        });

        await login(page);
        await expect(page.locator("html")).toHaveClass(/dark/);
        await page.locator(".bar-confirmed path").first().hover();

        const item = page.locator(".recharts-tooltip-item").filter({ hasText: "Confirmado" });
        await expect(item).toBeVisible();
        const [text, background] = await Promise.all([
            item.evaluate(el => getComputedStyle(el).color),
            page.locator(".recharts-default-tooltip").first().evaluate(el => getComputedStyle(el).backgroundColor),
        ]);
        // AA para texto normal.
        expect(contrast(text, background), `${text} sobre ${background}`).toBeGreaterThanOrEqual(4.5);
    } finally {
        await db.$disconnect();
    }
});
