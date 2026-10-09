import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

// Testes de ponta a ponta (npm run test:e2e). Sobem o app na porta 3100
// apontando pro banco <nome>_e2e, derivado do DATABASE_URL (ou E2E_DATABASE_URL),
// separado do de desenvolvimento e do de integração (<nome>_test, que é
// limpo a cada teste e não serve pra um fluxo que atravessa várias telas).
loadDotenv({ quiet: true });

function e2eDatabaseUrl(): string {
    if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.pathname = url.pathname.replace(/\/?([^/]+)$/, (_, name: string) => `/${name}_e2e`);
    return url.toString();
}

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
process.env.E2E_DATABASE_URL = e2eDatabaseUrl();

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",
    // Um fluxo por vez: todos compartilham o mesmo banco e o mesmo usuário.
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
    use: {
        baseURL: E2E_BASE_URL,
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
    webServer: {
        // No CI, build de produção: no next dev a primeira visita a cada página
        // compila na hora e pode passar de um minuto numa máquina fria.
        command: process.env.CI
            ? `npx next build && npx next start -p ${E2E_PORT}`
            : `npx next dev -p ${E2E_PORT}`,
        url: `${E2E_BASE_URL}/auth/login`,
        timeout: 180_000,
        reuseExistingServer: false,
        env: {
            DATABASE_URL: process.env.E2E_DATABASE_URL,
            NEXTAUTH_URL: E2E_BASE_URL,
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret",
        },
    },
});
