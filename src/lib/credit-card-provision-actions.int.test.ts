import { beforeEach, describe, expect, test, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { dateOnlyYmd } from "@/lib/date-only";
import { provisionEstimatedExpense } from "./credit-card-provision-actions";
import { createUserWithCard, type Scenario } from "../../test/fixtures";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// BL-013/BL-014: despesa prevista genérica (sem cartão), à vista e parcelada.
describe("provisionEstimatedExpense sem cartão", () => {
    let s: Scenario;
    const input = (extra: Record<string, unknown> = {}) => ({
        descricao: "matrícula escola", valor: 320, categoria_id: s.category.id, invoice_month: 11, invoice_year: 2026,
        tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id, ...extra,
    });
    const mine = () => db.transaction.findMany({ where: { userId: s.user.id }, orderBy: { data_vencimento: "asc" } });

    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("à vista: um lançamento previsto no dia 1º do mês escolhido", async () => {
        await provisionEstimatedExpense(input());

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento), r.is_provisioned])).toEqual([
            ["Matrícula escola", 320, "2026-11-01", true],
        ]);
    });

    test("parcelado: divide em centavos e atravessa o ano", async () => {
        await provisionEstimatedExpense(input({ isInstallment: true, installmentsCount: 3 }));

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento)])).toEqual([
            ["Matrícula escola (01/03)", 106.66, "2026-11-01"],
            ["Matrícula escola (02/03)", 106.66, "2026-12-01"],
            ["Matrícula escola (03/03)", 106.68, "2027-01-01"],
        ]);
        expect(rows.every(r => r.is_provisioned && r.credit_card_id === null)).toBe(true);
    });
});
