import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Testes de integração rodam num banco separado (<banco>_test), derivado do
// DATABASE_URL do .env — nunca no banco de desenvolvimento.
function testDatabaseUrl(): string {
    const env = loadEnv("test", process.cwd(), "");
    const explicit = env.TEST_DATABASE_URL;
    if (explicit) return explicit;
    const url = new URL(env.DATABASE_URL ?? "");
    url.pathname = url.pathname.replace(/\/?([^/]+)$/, (_, name: string) => `/${name}_test`);
    return url.toString();
}

const alias = { "@": path.resolve(__dirname, "src") };

export default defineConfig({
    resolve: { alias },
    test: {
        projects: [
            {
                resolve: { alias },
                test: {
                    name: "unit",
                    include: ["src/**/*.test.ts"],
                    exclude: ["src/**/*.int.test.ts"],
                    environment: "node",
                },
            },
            {
                resolve: { alias },
                test: {
                    name: "integration",
                    include: ["src/**/*.int.test.ts"],
                    environment: "node",
                    env: { DATABASE_URL: testDatabaseUrl() },
                    globalSetup: ["./test/integration-global-setup.ts"],
                    setupFiles: ["./test/integration-setup.ts"],
                    // Um arquivo por vez: todos compartilham o mesmo banco de teste.
                    fileParallelism: false,
                },
            },
        ],
    },
});
