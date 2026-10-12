import { afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { assertSafeTestDatabase } from "./integration-global-setup";

assertSafeTestDatabase(process.env.DATABASE_URL ?? "");

// Cada teste começa com o banco vazio: quase todo modelo pende de User com
// onDelete: Cascade, então apagar os usuários limpa tudo. LoginFailure não
// pende (conta também e-mails que não existem) e é limpo à parte.
beforeEach(async () => {
    await db.user.deleteMany();
    await db.loginFailure.deleteMany();
});

afterAll(async () => {
    await db.$disconnect();
});
