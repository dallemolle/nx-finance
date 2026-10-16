import { beforeEach, describe, expect, test, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { dateOnlyUtc, dateOnlyYmd } from "@/lib/date-only";
import { createCategory, createTransaction, deleteTransaction, payTransaction, updateTransaction } from "./actions";
import { areColorsSimilar, CATEGORY_PALETTE } from "./category-colors";
import { createUserWithCard, type Scenario } from "../../test/fixtures";

import { unwrap } from "@/lib/action-result";
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

        await payTransaction(t.id).then(unwrap);

        const paid = await db.transaction.findUniqueOrThrow({ where: { id: t.id } });
        expect(paid.status).toBe("PAGO");
        expect(paid.data_pagamento).not.toBeNull();
    });

    // BL-009: liquidar uma previsão deixava o lançamento pago e ainda previsto
    // (fora dos totais, sem nunca ter sido efetivado).
    test("recusa liquidar um lançamento previsto", async () => {
        const t = await expense(true);

        await expect(payTransaction(t.id).then(unwrap)).rejects.toThrow(/previst/i);

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
        await createTransaction(input()).then(unwrap);

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento)])).toEqual([["Geladeira", 320, "2026-01-31"]]);
    });

    test("parcelado: divide em centavos (a última absorve o resto), um mês por parcela", async () => {
        await createTransaction(input({ isInstallment: true, installmentsCount: 3 })).then(unwrap);

        const rows = await mine();
        expect(rows.map(r => [r.descricao, Number(r.valor), dateOnlyYmd(r.data_vencimento)])).toEqual([
            ["Geladeira (01/03)", 106.66, "2026-01-31"],
            ["Geladeira (02/03)", 106.66, "2026-02-28"],
            ["Geladeira (03/03)", 106.68, "2026-03-31"],
        ]);
        expect(rows.reduce((sum, r) => sum + Number(r.valor), 0)).toBeCloseTo(320, 2);
    });

    test("parcelado com descrições próprias por parcela", async () => {
        await createTransaction(input({ isInstallment: true, installmentsCount: 2, installmentDescriptions: ["Entrada", ""] })).then(unwrap);

        expect((await mine()).map(r => r.descricao)).toEqual(["Entrada", "Geladeira (02/02)"]);
    });

    test("editar não cria parcelas nem grava os campos do formulário de parcelamento", async () => {
        const data = await createTransaction(input()).then(unwrap);

        await updateTransaction(data.id, input({ valor: 350, isInstallment: true, installmentsCount: 4 })).then(unwrap);

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

        await expect(updateTransaction(theirs.id, input()).then(unwrap)).rejects.toThrow();
        expect(Number((await db.transaction.findUniqueOrThrow({ where: { id: theirs.id } })).valor)).toBe(10);
    });

    // BL-038: voltar de Pago para Pendente deixava a data de pagamento antiga gravada.
    test("data de pagamento acompanha o status na edição", async () => {
        const data = await createTransaction(input()).then(unwrap);
        await payTransaction(data.id).then(unwrap);
        const paidAt = (await db.transaction.findUniqueOrThrow({ where: { id: data.id } })).data_pagamento;

        await updateTransaction(data.id, input({ status: "PAGO", valor: 330 })).then(unwrap);
        expect((await db.transaction.findUniqueOrThrow({ where: { id: data.id } })).data_pagamento).toEqual(paidAt);

        await updateTransaction(data.id, input({ status: "PENDENTE" })).then(unwrap);
        expect((await db.transaction.findUniqueOrThrow({ where: { id: data.id } })).data_pagamento).toBeNull();

        await updateTransaction(data.id, input({ status: "PAGO" })).then(unwrap);
        expect((await db.transaction.findUniqueOrThrow({ where: { id: data.id } })).data_pagamento).not.toBeNull();
    });
});

// BL-038: qualquer lançamento pendente se exclui; pago, só depois de voltar para Pendente.
describe("deleteTransaction", () => {
    let s: Scenario;
    const create = (extra: Record<string, unknown> = {}, owner: Scenario = s) => db.transaction.create({
        data: {
            descricao: "Aluguel", valor: 1500, data_vencimento: dateOnlyUtc(2026, 11, 5), status: "PENDENTE", tipo: "SAIDA",
            userId: owner.user.id, categoria_id: owner.category.id, tipo_pagamento_id: owner.paymentMethod.id, institution_id: owner.institution.id,
            ...extra,
        },
    });
    const exists = async (id: string) => (await db.transaction.count({ where: { id } })) === 1;

    beforeEach(async () => {
        s = await createUserWithCard();
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });
    });

    test("exclui lançamento pendente, atrasado, entrada e despesa prevista", async () => {
        const rows = await Promise.all([
            create(), create({ status: "ATRASADO" }), create({ tipo: "ENTRADA" }), create({ is_provisioned: true }),
        ]);

        for (const r of rows) await deleteTransaction(r.id).then(unwrap);

        expect(await db.transaction.count({ where: { userId: s.user.id } })).toBe(0);
    });

    test("recusa lançamento pago, e exclui depois de voltar para Pendente", async () => {
        const t = await create({ status: "PAGO", data_pagamento: new Date() });

        await expect(deleteTransaction(t.id).then(unwrap)).rejects.toThrow(/Volte o status para Pendente/);
        expect(await exists(t.id)).toBe(true);

        await updateTransaction(t.id, { descricao: "Aluguel", valor: 1500, data_vencimento: "2026-11-05", status: "PENDENTE", tipo: "SAIDA", categoria_id: s.category.id, tipo_pagamento_id: s.paymentMethod.id, institution_id: s.institution.id }).then(unwrap);
        await deleteTransaction(t.id).then(unwrap);
        expect(await exists(t.id)).toBe(false);
    });

    test("recusa fatura de cartão e lançamento de outro usuário", async () => {
        const header = await create({ is_invoice_header: true, credit_card_id: s.card.id });
        const other = await createUserWithCard();
        const theirs = await create({}, other);

        await expect(deleteTransaction(header.id).then(unwrap)).rejects.toThrow(/Fatura/);
        await expect(deleteTransaction(theirs.id).then(unwrap)).rejects.toThrow(/não encontrado/);
        expect([await exists(header.id), await exists(theirs.id)]).toEqual([true, true]);
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
            const created = await createCategory({ nome: `nova ${i}`, icone: "Tag", tipo: "SAIDA" }).then(unwrap);
            expect(created.cor).toMatch(/^#[0-9a-f]{6}$/);
            expect(all.some(c => areColorsSimilar(c, created.cor)), created.cor).toBe(false);
            all.push(created.cor);
        }
    });

    test("cor informada é respeitada", async () => {
        const created = await createCategory({ nome: "escolhida", cor: "#123456", icone: "Tag", tipo: "SAIDA" }).then(unwrap);

        expect(created.cor).toBe("#123456");
    });

    test("só olha as categorias do próprio usuário", async () => {
        // Eu uso a paleta toda menos o azul-petróleo; o outro usuário usa justamente ele.
        const mine = CATEGORY_PALETTE.filter(c => c !== "#14b8a6");
        await db.category.createMany({ data: mine.map((cor, i) => ({ nome: `Minha ${i}`, cor, icone: "Tag", tipo: "SAIDA" as const, userId: s.user.id })) });
        const other = await createUserWithCard();
        await db.category.update({ where: { id: other.category.id }, data: { cor: "#14b8a6" } });

        const created = await createCategory({ nome: "nova", icone: "Tag", tipo: "SAIDA" }).then(unwrap);

        expect(created.cor).toBe("#14b8a6");
    });});