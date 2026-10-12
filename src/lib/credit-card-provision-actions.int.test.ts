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

// BL-030: recorrente = o mesmo valor, cheio, em cada mês (não divide).
describe("provisionEstimatedExpense recorrente", () => {
    let s: Scenario;
    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("genérica: uma prevista por mês, valor cheio, sem numeração, atravessando o ano", async () => {
        await provisionEstimatedExpense({
            descricao: "academia", valor: 120, categoria_id: s.category.id, invoice_month: 11, invoice_year: 2026,
            tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id, isRecurring: true, recurringMonths: 3,
        });

        const rows = await db.transaction.findMany({ where: { userId: s.user.id }, orderBy: { data_vencimento: "asc" } });
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento), r.is_provisioned, r.credit_card_id])).toEqual([
            ["Academia", 120, "2026-11-01", true, null],
            ["Academia", 120, "2026-12-01", true, null],
            ["Academia", 120, "2027-01-01", true, null],
        ]);
    });

    test("no cartão: um item de valor cheio na fatura prevista de cada mês", async () => {
        await provisionEstimatedExpense({
            descricao: "streaming", valor: 39.9, categoria_id: s.category.id, invoice_month: 11, invoice_year: 2026,
            credit_card_id: s.card.id, isRecurring: true, recurringMonths: 3,
        });

        const headers = await db.transaction.findMany({
            where: { userId: s.user.id, is_invoice_header: true },
            include: { invoiceItems: true },
            orderBy: { data_vencimento: "asc" },
        });
        // Cartão fecha 25 / vence 5: o ciclo de novembro vence em 05/12.
        expect(headers.map(h => [h.invoice_month, h.invoice_year, dateOnlyYmd(h.data_vencimento), Number(h.valor), h.is_provisioned])).toEqual([
            [11, 2026, "2026-12-05", 39.9, true],
            [12, 2026, "2027-01-05", 39.9, true],
            [1, 2027, "2027-02-05", 39.9, true],
        ]);
        expect(headers.flatMap(h => h.invoiceItems.map(i => [i.descricao, Number(i.valor), i.is_provisioned, i.installment_group_id]))).toEqual([
            ["Streaming", 39.9, true, null],
            ["Streaming", 39.9, true, null],
            ["Streaming", 39.9, true, null],
        ]);
    });

    test("no cartão: soma na fatura prevista que já existe no mês, sem duplicar o cabeçalho", async () => {
        const base = { categoria_id: s.category.id, invoice_month: 11, invoice_year: 2026, credit_card_id: s.card.id };
        await provisionEstimatedExpense({ ...base, descricao: "mercado", valor: 400 });

        await provisionEstimatedExpense({ ...base, descricao: "streaming", valor: 40, isRecurring: true, recurringMonths: 2 });

        const headers = await db.transaction.findMany({ where: { userId: s.user.id, is_invoice_header: true }, orderBy: { data_vencimento: "asc" } });
        expect(headers.map(h => [h.invoice_month, Number(h.valor)])).toEqual([[11, 440], [12, 40]]);
    });
});