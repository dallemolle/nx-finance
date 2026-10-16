import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-043: cadastro fechado por padrão — sem link no login e a página leva pro login.
test("cadastro fechado: sem link no login e /auth/register volta pro login", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastre-se" })).toHaveCount(0);

    await page.goto("/auth/register");
    await expect(page).toHaveURL(/\/auth\/login$/);
});

// BL-042: alterar senha em Configurações → Segurança.
test("altera a senha pela aba Segurança", async ({ page }) => {
    const db = e2eDb();
    const NEW = "senha-nova-e2e-456";
    try {
        await login(page);
        await page.goto("/dashboard/settings");
        await page.getByRole("tab", { name: "Segurança" }).click();
        const form = page.getByRole("form", { name: "Alterar senha" });

        await form.getByLabel("Senha atual").fill("senha-errada");
        await form.getByLabel("Nova senha", { exact: true }).fill(NEW);
        await form.getByLabel("Confirmar nova senha").fill(NEW);
        await form.getByRole("button", { name: "Alterar senha" }).click();
        await expect(form.getByRole("alert")).toHaveText("Senha atual incorreta");

        await form.getByLabel("Senha atual").fill(E2E_USER.password);
        await form.getByRole("button", { name: "Alterar senha" }).click();
        await expect(page.getByText("Senha alterada.")).toBeVisible();
        await expect(form.getByLabel("Senha atual")).toHaveValue("");

        const { password } = await db.user.findUniqueOrThrow({ where: { email: E2E_USER.email } });
        expect(await bcrypt.compare(NEW, password)).toBe(true);
    } finally {
        // Os outros testes entram com a senha do seed.
        await db.user.update({ where: { email: E2E_USER.email }, data: { password: await bcrypt.hash(E2E_USER.password, 10) } });
        await db.loginFailure.deleteMany();
        await db.$disconnect();
    }
});
