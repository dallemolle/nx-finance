import { expect, test } from "@playwright/test";
import { brDate, E2E_USER, e2eDb, login } from "./fixtures";

// Fluxo principal do app pela tela: importar a fatura do cartão a partir do
// CSV do banco, categorizar, marcar uma compra parcelada e conferir o que
// foi gravado e o que aparece em /faturas.
test("importa a fatura do cartão a partir do CSV, com parcela projetada nas próximas faturas", async ({ page }) => {
    const csv = [
        "data,descricao,valor",
        `${brDate(3)},Mercado Dia,"R$ 1.234,56"`,
        `${brDate(2)},UBER *TRIP 1111,"23,90"`,
        `${brDate(2)},UBER *TRIP 2222,"18,00"`,
        `${brDate(1)},Loja Movel - Parcela 1/3,"300,00"`,
        `${brDate(1)},Estorno Loja,"-50,00"`,
    ].join("\n");

    await login(page);
    // Usuário sem lançamentos: o dashboard vazio também tem um "Importar Fatura"; o do topo é o primeiro.
    await page.getByRole("button", { name: "Importar Fatura" }).first().click();
    const dialog = page.getByRole("dialog");

    // Etapa 1: arquivo + cartão; o cartão preenche o resto (BL-001)
    await expect(dialog.getByText(/Falta: arquivo CSV/)).toBeVisible();
    await dialog.locator("#invoiceFile").setInputFiles({ name: "fatura.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog.getByText("fatura.csv")).toBeVisible();

    await dialog.getByLabel("Cartão de Crédito (opcional)").click();
    await page.getByRole("button", { name: E2E_USER.cardName }).click();
    await expect(dialog.getByLabel("Descrição da Fatura")).toHaveValue(new RegExp(`^Fatura ${E2E_USER.cardName} `));
    await expect(dialog.getByLabel("Data de Vencimento da Fatura")).toHaveValue(/^\d{4}-\d{2}-08$/);
    await expect(dialog.getByLabel("Instituição (Bandeira)")).toHaveText("Banco E2E");
    await expect(dialog.getByLabel("Meio de Pagamento")).toHaveText("Cartão de crédito");
    await dialog.getByRole("button", { name: /Próximo/ }).click();

    // Etapa 2: revisão. Valor com milhar lido certo (BL-024) e estorno destacado (BL-005)
    await expect(dialog.getByLabel("Valor do item 1")).toHaveValue("1.234,56");
    await expect(dialog.getByText("Estorno", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Faltam categorizar 5 itens")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Importar Fatura/ })).toBeDisabled();

    // Categoria de um Uber vale pro outro (BL-002)
    await dialog.getByLabel("Categoria do item 2").click();
    await page.getByRole("option", { name: "Transporte" }).click();
    await expect(dialog.getByLabel("Categoria do item 3")).toHaveText("Transporte");

    // Parcela 1/3 ativada pelo atalho
    await dialog.getByRole("button", { name: "1/3 · Ativar" }).click();
    await expect(dialog.locator("tbody tr").nth(3).getByText("1/3", { exact: true })).toBeVisible();

    // Voltar e avançar preserva o que foi feito (BL-003)
    await dialog.getByRole("button", { name: /Voltar/ }).click();
    await dialog.getByRole("button", { name: /Próximo/ }).click();
    await expect(dialog.getByLabel("Categoria do item 2")).toHaveText("Transporte");

    // O resto vai pra "Compras" de uma vez
    await dialog.getByLabel("Aplicar uma categoria a todos os itens sem categoria").click();
    await page.getByRole("option", { name: "Compras" }).click();

    const importButton = dialog.getByRole("button", { name: "Importar Fatura (R$ 1.526,46)" });
    await expect(importButton).toBeEnabled();
    await importButton.click();
    await expect(dialog).toBeHidden();

    // O que foi gravado
    const db = e2eDb();
    try {
        const header = await db.transaction.findFirstOrThrow({
            where: { is_invoice_header: true, is_provisioned: false, creditCard: { nome: E2E_USER.cardName } },
            include: { invoiceItems: { include: { category: true }, orderBy: { descricao: "asc" } } },
        });
        expect(Number(header.valor)).toBeCloseTo(1526.46, 2);
        expect(header.invoiceItems.map(i => [i.descricao, i.category.nome])).toEqual([
            ["Estorno Loja", "Compras"],
            ["Loja Movel - Parcela 1/3", "Compras"],
            ["Mercado Dia", "Compras"],
            ["UBER *TRIP 1111", "Transporte"],
            ["UBER *TRIP 2222", "Transporte"],
        ]);
        // Data do CSV em dd/mm/aaaa gravada como o mesmo dia do calendário (BL-024).
        // Convenção atual: data sem hora fica à meia-noite UTC — ver BL-025, que
        // trata a exibição no fuso de Brasília mostrar o dia anterior.
        const mercado = header.invoiceItems.find(i => i.descricao === "Mercado Dia")!;
        const [d, m, y] = brDate(3).split("/").map(Number);
        expect([mercado.data_compra.getUTCFullYear(), mercado.data_compra.getUTCMonth() + 1, mercado.data_compra.getUTCDate()]).toEqual([y, m, d]);

        const projected = await db.creditCardInvoiceItem.findMany({
            where: { is_provisioned: true, installment_total: 3 },
            orderBy: { installment_number: "asc" },
        });
        expect(projected.map(i => [i.descricao, Number(i.valor)])).toEqual([
            ["Loja Movel (02/03)", 300],
            ["Loja Movel (03/03)", 300],
        ]);
    } finally {
        await db.$disconnect();
    }

    // E o que aparece em /faturas
    await page.goto("/faturas");
    await expect(page.getByText(E2E_USER.cardName)).toBeVisible();
    await page.getByRole("button", { name: "Ver meses" }).click();
    await page.getByRole("button", { name: "Expandir todos os meses" }).click();
    await expect(page.getByText("Loja Movel (02/03)")).toBeVisible();
    await expect(page.getByText("Loja Movel (03/03)")).toBeVisible();
});
