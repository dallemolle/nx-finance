import { expect, test, type Page } from "@playwright/test";
import { generate } from "otplib";
import { E2E_USER, e2eDb, login } from "./fixtures";

// BL-021/BL-022 pela tela: ativar o 2FA (com senha), guardar os códigos de
// recuperação, entrar com um deles (uma vez só) e desativar com senha + código.
// Nomes de botão com exact: "Desativar 2FA" contém "ativar 2FA", e sem exact o
// Playwright casaria um com o outro.

async function startLogin(page: Page) {
    await page.goto("/auth/login", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: "E-mail" }).fill(E2E_USER.email);
    await page.getByRole("textbox", { name: "Senha" }).fill(E2E_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("textbox", { name: "Código de Verificação" })).toBeVisible();
}

async function openSecurityTab(page: Page) {
    await page.goto("/dashboard/settings");
    await page.getByRole("tab", { name: "Segurança" }).click();
}

test("2FA: ativa com senha, entra com código de recuperação uma vez e desativa", async ({ page }) => {
    try {
        await login(page);
        await openSecurityTab(page);
        await page.getByRole("button", { name: "Ativar 2FA", exact: true }).click();
        const secret = (await page.locator("code").first().textContent())!.trim();

        await page.getByLabel("Código do app").fill(await generate({ secret }));
        await page.getByLabel("Senha", { exact: true }).fill(E2E_USER.password);
        await page.getByRole("button", { name: "Confirmar e Ativar" }).click();

        const codesRegion = page.getByRole("region", { name: "Códigos de recuperação" });
        await expect(codesRegion).toBeVisible();
        const codes = await codesRegion.getByRole("listitem").allTextContents();
        expect(codes).toHaveLength(10);
        await page.getByRole("button", { name: "Já guardei os códigos" }).click();
        await expect(page.getByText("10 códigos de recuperação disponíveis.")).toBeVisible();

        // Sai e entra com um código de recuperação (digitado em minúscula)
        await page.context().clearCookies();
        await startLogin(page);
        await page.getByRole("textbox", { name: "Código de Verificação" }).fill(codes[0].toLowerCase());
        await page.getByRole("button", { name: "Verificar Código" }).click();
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 60_000 });

        // O mesmo código não serve de novo
        await page.context().clearCookies();
        await startLogin(page);
        await page.getByRole("textbox", { name: "Código de Verificação" }).fill(codes[0]);
        await page.getByRole("button", { name: "Verificar Código" }).click();
        await expect(page.getByText("Código de verificação inválido")).toBeVisible();

        // Entra com o app e desativa: senha + código
        await page.getByRole("textbox", { name: "Código de Verificação" }).fill(await generate({ secret }));
        await page.getByRole("button", { name: "Verificar Código" }).click();
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 60_000 });
        await openSecurityTab(page);
        await expect(page.getByText("9 códigos de recuperação disponíveis.")).toBeVisible();

        await page.getByRole("button", { name: "Desativar 2FA", exact: true }).click();
        await page.getByLabel("Código do app ou de recuperação").fill(codes[1]);
        await expect(page.getByRole("button", { name: "Desativar 2FA", exact: true })).toBeDisabled(); // sem senha não envia
        await page.getByLabel("Senha", { exact: true }).fill(E2E_USER.password);
        await page.getByRole("button", { name: "Desativar 2FA", exact: true }).click();
        await expect(page.getByText("2FA desativado.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Ativar 2FA", exact: true })).toBeVisible();
    } finally {
        // Os outros testes entram sem 2FA.
        const db = e2eDb();
        try {
            const user = await db.user.update({ where: { email: E2E_USER.email }, data: { status_2fa: false, secret_2fa: null } });
            await db.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } });
        } finally {
            await db.$disconnect();
        }
    }
});
