import { beforeEach, describe, expect, test, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { dateOnlyUtc } from "@/lib/date-only";
import { payTransaction } from "./actions";
import { createUserWithCard, type Scenario } from "../../test/fixtures";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("payTransaction", () => {
    let s: Scenario;
    const expense = (is_provisioned: boolean) => db.transaction.create({
        data: {
            descricao: "Conta", valor: 100, data_vencimento: dateOnlyUtc(2026, 10, 10), status: "PENDENTE", tipo: "SAIDA",
            is_provisioned, userId: s.user.id, categoria_id: s.category.id, tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id,
        },
    });

    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("liquida um lançamento real", async () => {
        const t = await expense(false);

        await payTransaction(t.id);

        const paid = await db.transaction.findUniqueOrThrow({ where: { id: t.id } });
        expect(paid.status).toBe("PAGO");
        expect(paid.data_pagamento).not.toBeNull();
    });

    // BL-009: liquidar uma previsão deixava o lançamento pago e ainda previsto
    // (fora dos totais, sem nunca ter sido efetivado).
    test("recusa liquidar um lançamento previsto", async () => {
        const t = await expense(true);

        await expect(payTransaction(t.id)).rejects.toThrow(/previst/i);

        expect((await db.transaction.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("PENDENTE");
    });
});
