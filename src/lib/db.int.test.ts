import { expect, test } from "vitest";
import { db } from "./db";

test("testes de integração rodam no banco _test, começando vazio", async () => {
    const [{ current_database }] = await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    expect(current_database).toMatch(/_test$/);
    expect(await db.user.count()).toBe(0);
});
