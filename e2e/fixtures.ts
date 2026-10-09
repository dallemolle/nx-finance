import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const E2E_USER = {
    email: "e2e@example.com",
    password: "senha-e2e-123",
    cardName: "Cartao E2E",
};

export function e2eDb() {
    return new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });
}

export async function login(page: Page) {
    // networkidle: só preenche depois que o React assumiu o formulário (senão
    // o estado controlado dos campos fica vazio e o login não acontece).
    await page.goto("/auth/login", { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: "E-mail" }).fill(E2E_USER.email);
    await page.getByRole("textbox", { name: "Senha" }).fill(E2E_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    // Folga extra: no next dev a primeira visita ao dashboard ainda compila.
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 60_000 });
}

// Data relativa a hoje no formato do extrato brasileiro (dd/mm/aaaa).
export function brDate(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
