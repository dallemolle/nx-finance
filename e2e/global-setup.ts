import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E_USER } from "./fixtures";

// Antes da suíte: garante o schema no banco de e2e, apaga tudo e cria o
// cenário base (usuário, instituição, cartão, categorias, meio de pagamento).
export default async function globalSetup() {
    const url = process.env.E2E_DATABASE_URL ?? "";
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, "");
    if (!/^(localhost|127\.0\.0\.1)$/.test(parsed.hostname) || !dbName.endsWith("_e2e")) {
        throw new Error(`Banco de e2e inseguro (${parsed.hostname}/${dbName}): precisa ser local e terminar em _e2e.`);
    }

    execSync("npx prisma db push --skip-generate --accept-data-loss", {
        env: { ...process.env, DATABASE_URL: url },
        stdio: "pipe",
    });

    const db = new PrismaClient({ datasourceUrl: url });
    try {
        await db.user.deleteMany();
        const user = await db.user.create({
            data: { email: E2E_USER.email, password: await bcrypt.hash(E2E_USER.password, 10) },
        });
        const institution = await db.financialInstitution.create({ data: { nome: "Banco E2E", userId: user.id } });
        await db.creditCard.create({
            data: { nome: E2E_USER.cardName, closingDay: 25, dueDay: 8, institution_id: institution.id, userId: user.id },
        });
        await db.category.createMany({
            data: ["Mercado", "Transporte", "Compras"].map(nome => ({ nome, cor: "#6366f1", icone: "Wallet", tipo: "SAIDA" as const, userId: user.id })),
        });
        await db.paymentMethod.create({ data: { nome: "Cartão de crédito", userId: user.id } });
    } finally {
        await db.$disconnect();
    }
}
