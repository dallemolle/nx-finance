import { afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { assertSafeTestDatabase } from "./integration-global-setup";

assertSafeTestDatabase(process.env.DATABASE_URL ?? "");

// Cada teste começa com o banco vazio: todo modelo pende de User com
// onDelete: Cascade, então apagar os usuários limpa tudo.
beforeEach(async () => {
    await db.user.deleteMany();
});

afterAll(async () => {
    await db.$disconnect();
});
