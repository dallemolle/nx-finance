import { beforeEach, describe, expect, test, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { dateOnlyUtc, dateOnlyYmd } from "@/lib/date-only";
import { createCategory, createTransaction, payTransaction, updateTransaction } from "./actions";
import { areColorsSimilar, CATEGORY_PALETTE } from "./category-colors";
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

describe("createTransaction e updateTransaction (BL-013/BL-014)", () => {
    let s: Scenario;
    const input = (extra: Record<string, unknown> = {}) => ({
        descricao: "geladeira", valor: 320, data_vencimento: "2026-01-31", status: "PENDENTE" as const, tipo: "SAIDA" as const,
        categoria_id: s.category.id, tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id, ...extra,
    });
    const mine = () => db.transaction.findMany({ where: { userId: s.user.id }, orderBy: { data_vencimento: "asc" } });

    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("à vista: um lançamento com a descrição normalizada", async () => {
        await createTransaction(input());

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento)])).toEqual([["Geladeira", 320, "2026-01-31"]]);
    });

    test("parcelado: divide em centavos (a última absorve o resto), um mês por parcela", async () => {
        await createTransaction(input({ isInstallment: true, installmentsCount: 3 }));

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento)])).toEqual([
            ["Geladeira (01/03)", 106.66, "2026-01-31"],
            ["Geladeira (02/03)", 106.66, "2026-02-28"],
            ["Geladeira (03/03)", 106.68, "2026-03-31"],
        ]);
        expect(rows.reduce((sum, r) => sum + Number(r.valor), 0)).toBeCloseTo(320, 2);
    });

    test("parcelado com descrições próprias por parcela", async () => {
        await createTransaction(input({ isInstallment: true, installmentsCount: 2, installmentDescriptions: ["Entrada", ""] }));

        expect((await mine()).map(r => r.descricao)).toEqual(["Entrada", "Geladeira (02/02)"]);
    });

    test("editar não cria parcelas nem grava os campos do formulário de parcelamento", async () => {
        const { data } = await createTransaction(input());

        await updateTransaction(data.id, input({ valor: 350, isInstallment: true, installmentsCount: 4 }));

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor)])).toEqual([["Geladeira", 350]]);
    });

    test("não edita lançamento de outro usuário", async () => {
        const other = await createUserWithCard();
        const theirs = await db.transaction.create({
            data: {
                descricao: "Do outro", valor: 10, data_vencimento: dateOnlyUtc(2026, 1, 1), status: "PENDENTE", tipo: "SAIDA",
                userId: other.user.id, categoria_id: other.category.id, tipo_pagamento_id: other.paymentMethod.id, institution_id: other.institution.id,
            },
        });

        await expect(updateTransaction(theirs.id, input())).rejects.toThrow();
        expect(Number((await db.transaction.findUniqueOrThrow({ where: { id: theirs.id } })).valor)).toBe(10);
    });
});
// Nova categoria sem cor: o servidor sorteia uma diferente das que o usuário já usa.
describe("createCategory: cor sorteada", () => {
    let s: Scenario;
    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("sem cor: sorteia uma que não repete nem lembra as existentes", async () => {
        const used = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];
        await db.category.createMany({ data: used.map((cor, i) => ({ nome: `Usada ${i}`, cor, icone: "Tag", tipo: "SAIDA" as const, userId: s.user.id })) });
        const all = [...used, s.category.cor];

        for (let i = 0; i < 5; i++) {
            const created = await createCategory({ nome: `nova ${i}`, icone: "Tag", tipo: "SAIDA" });
            expect(created.cor).toMatch(/^#[0-9a-f]{6}$/);
            expect(all.some(c => areColorsSimilar(c, created.cor)), created.cor).toBe(false);
            all.push(created.cor);
        }
    });

    test("cor informada é respeitada", async () => {
        const created = await createCategory({ nome: "escolhida", cor: "#123456", icone: "Tag", tipo: "SAIDA" });

        expect(created.cor).toBe("#123456");
    });

    test("só olha as categorias do próprio usuário", async () => {
        // Eu uso a paleta toda menos o azul-petróleo; o outro usuário usa justamente ele.
        const mine = CATEGORY_PALETTE.filter(c => c !== "#14b8a6");
        await db.category.createMany({ data: mine.map((cor, i) => ({ nome: `Minha ${i}`, cor, icone: "Tag", tipo: "SAIDA" as const, userId: s.user.id })) });
        const other = await createUserWithCard();
        await db.category.update({ where: { id: other.category.id }, data: { cor: "#14b8a6" } });

        const created = await createCategory({ nome: "nova", icone: "Tag", tipo: "SAIDA" });

        expect(created.cor).toBe("#14b8a6");
    });});