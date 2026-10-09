import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

// Roda uma vez antes da suíte de integração: garante que o banco de teste
// existe e está com o schema atual (o projeto sincroniza schema via db push,
// não via migrations).
export default function setup(project: TestProject) {
    const url = project.config.env.DATABASE_URL as string;
    assertSafeTestDatabase(url);
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
        env: { ...process.env, DATABASE_URL: url },
        stdio: "pipe",
    });
}

export function assertSafeTestDatabase(url: string) {
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, "");
    if (!/^(localhost|127\.0\.0\.1)$/.test(parsed.hostname) || !dbName.endsWith("_test")) {
        throw new Error(`Banco de teste inseguro (${parsed.hostname}/${dbName}): precisa ser local e terminar em _test.`);
    }
}
