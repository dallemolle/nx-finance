import { expect, test } from "@playwright/test";

// BL-036: depois de 10 tentativas erradas, o login mostra o bloqueio na tela.
// E-mail que não existe: o limite vale igual e não trava o usuário dos outros testes.
test("bloqueia o login depois de 10 tentativas erradas", async ({ page }) => {
    await page.goto("/auth/login", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: "E-mail" }).fill("ninguem-e2e@example.com");
    await page.getByRole("textbox", { name: "Senha" }).fill("senha-errada");
    const entrar = page.getByRole("button", { name: "Entrar" });

    for (let i = 0; i < 10; i++) {
        await entrar.click();
        await expect(page.getByText("Credenciais inválidas")).toBeVisible();
        await expect(entrar).toBeEnabled();
    }

    await entrar.click();
    await expect(page.getByText("Muitas tentativas de login. Tente novamente em 15 minutos.")).toBeVisible();
});
