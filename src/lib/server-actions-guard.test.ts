import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Toda função exportada de um arquivo "use server" vira um endpoint que o
// navegador pode chamar com os argumentos que quiser. Se ela aceita userId
// (ou um tx do Prisma) por parâmetro, qualquer um consegue pedir dados de
// outro usuário. O userId tem que vir da sessão, dentro da função; regras
// que precisam recebê-lo explicitamente moram em src/lib/services/.
const SRC = path.resolve(__dirname, "..");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return listFiles(full);
        return /\.tsx?$/.test(name) ? [full] : [];
    });
}

const serverActionFiles = listFiles(SRC).filter(f => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

describe("Server Actions", () => {
    test("existem arquivos \"use server\" pra verificar", () => {
        expect(serverActionFiles.length).toBeGreaterThan(0);
    });

    test("nenhuma função exportada recebe userId ou tx por parâmetro", () => {
        const offenders = serverActionFiles.flatMap(file => {
            const source = readFileSync(file, "utf8");
            const signatures = source.matchAll(/export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g);
            return [...signatures]
                .filter(([, , params]) => /\b(userId|tx)\s*:/.test(params))
                .map(([, name]) => `${path.relative(SRC, file)}: ${name}`);
        });

        expect(offenders).toEqual([]);
    });
});
