import { beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { dateOnlyUtc } from "@/lib/date-only";
import { getDashboardData, getMonthlyTrend } from "./dashboard";
import { createUserWithCard, type Scenario } from "../../test/fixtures";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));

// BL-025: datas gravadas são meia-noite UTC. Com o mês calculado no fuso local
// (Brasília no dev, e nos testes), o lançamento do dia 1º caía no mês anterior.
describe("dashboard: lançamento no dia 1º do mês", () => {
    let s: Scenario;

    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getSessionUserId).mockResolvedValue(s.user.id);
        await db.transaction.create({
            data: {
                descricao: "Aluguel", valor: 1000, data_vencimento: dateOnlyUtc(2026, 10, 1), status: "PENDENTE", tipo: "SAIDA",
                userId: s.user.id, categoria_id: s.category.id, tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id,
            },
        });
    });

    test("aparece em outubro, não em setembro", async () => {
        const october = await getDashboardData(10, 2026);
        const september = await getDashboardData(9, 2026);

        expect(october.monthlyTransactions.map(t => t.descricao)).toEqual(["Aluguel"]);
        expect(october.summary.totalSaidas).toBe(1000);
        expect(september.monthlyTransactions).toEqual([]);
        expect(september.summary.totalSaidas).toBe(0);
    });

    test("entra na barra de outubro da tendência de 6 meses", async () => {
        const trend = await getMonthlyTrend(10, 2026);

        expect(trend.map(b => b.saldo)).toEqual([0, 0, 0, 0, 0, -1000]);
    });
});
