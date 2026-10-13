import { expect, test } from "@playwright/test";
import { E2E_USER, e2eDb, login } from "./fixtures";

// Botão "Sugerir cor" em Configurações → Categorias: sorteia uma cor diferente
// da atual e das outras categorias, que só vale depois de salvar.
test("sugere uma cor nova para a categoria e salva", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/settings");
    await page.getByRole("tab", { name: "Categorias" }).click();

    const colorInput = page.getByLabel("Cor de Mercado");
    const before = await colorInput.inputValue();

    await page.getByRole("button", { name: "Sugerir cor para Mercado" }).click();
    await expect(colorInput).not.toHaveValue(before);
    const suggested = await colorInput.inputValue();
    expect(suggested).toMatch(/^#[0-9a-f]{6}$/);

    await page.getByRole("button", { name: "Salvar Mercado" }).click();
    await expect(page.getByText("Atualizado com sucesso!")).toBeVisible();

    const db = e2eDb();
    try {
        const user = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        const categories = await db.category.findMany({ where: { userId: user.id } });
        const mercado = categories.find(c => c.nome === "Mercado")!;
        expect(mercado.cor).toBe(suggested);
        expect(categories.filter(c => c.id !== mercado.id).map(c => c.cor)).not.toContain(suggested);
    } finally {
        await db.$disconnect();
    }
});
