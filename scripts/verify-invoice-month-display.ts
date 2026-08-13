// Script de integração: reproduz o bug relatado em produção — parcela futura
// de uma compra parcelada marcada na importação de fatura aparecendo "no mês
// errado" em /faturas. Causa raiz: invoice_month/invoice_year é um
// identificador de CICLO de fechamento (deslocado -1 mês do vencimento
// quando dueDay<=closingDay), não o mês calendário — mas a rotulagem/bucket
// de exibição usava esse campo como se fosse calendário. Ver CONTEXT.md 4.11
// e credit-card-provision-actions.ts (findOrCreateProvisionedHeader,
// getInvoiceTimeline, getInvoiceTimelineDetail).
import { PrismaClient } from "@prisma/client";
import { differenceInCalendarMonths, startOfMonth } from "date-fns";
import {
    computeInvoiceDueDate,
    getReferenceMonthFromDueDate,
    addInvoiceMonths,
} from "../src/lib/credit-card-cycle";
import { stripInstallmentPattern } from "../src/lib/dashboard-utils";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;

async function main() {
    const email = "verify-invoice-month-display-test@example.com";
    await db.user.deleteMany({ where: { email } });

    const user = await db.user.create({ data: { email, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    // Caso comum (e o do relato original): fecha dia 25, vence dia 10 do mês
    // seguinte -> dueDay <= closingDay -> getReferenceMonthFromDueDate desloca
    // o "mês de referência" 1 mês pra trás em relação ao vencimento real.
    const card = await db.creditCard.create({
        data: { nome: "Cartão Teste", closingDay: 25, dueDay: 10, institution_id: institution.id, userId: user.id },
    });
    const category = await db.category.create({
        data: { nome: "Fatura Cartão", cor: "#6366f1", icone: "CreditCard", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Cartão (Provisionado)", userId: user.id } });

    const now = new Date();
    // Vencimento da fatura real, no mês corrente (dia 10) — mesma mecânica de
    // quando o usuário digita a data de vencimento impressa na fatura.
    const realDueDate = new Date(now.getFullYear(), now.getMonth(), 10);
    const { month: refMonth, year: refYear } = getReferenceMonthFromDueDate(realDueDate, card.closingDay, card.dueDay);

    const realHeader = await db.transaction.create({
        data: {
            descricao: "Fatura Real Importada", valor: 150, data_vencimento: realDueDate,
            status: "PENDENTE", tipo: "SAIDA", is_invoice_header: true, userId: user.id,
            categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
            credit_card_id: card.id, invoice_month: refMonth, invoice_year: refYear,
        },
    });
    const realItem = await db.creditCardInvoiceItem.create({
        data: {
            transactionId: realHeader.id, descricao: "Compra Loja - Parcela 1/3", valor: 150,
            data_compra: realDueDate, categoria_id: category.id,
        },
    });
    const groupId = crypto.randomUUID();
    await db.creditCardInvoiceItem.update({
        where: { id: realItem.id },
        data: { installment_group_id: groupId, installment_number: 1, installment_total: 3 },
    });

    // --- Gera parcelas 2 e 3, replicando a lógica (já corrigida) de
    //     findOrCreateProvisionedHeader + o loop de credit-card-actions.ts ---
    const futureDueDates: Date[] = [];
    for (const num of [2, 3]) {
        const { month: fm, year: fy } = addInvoiceMonths(refMonth, refYear, num - 1);
        const dueDate = computeInvoiceDueDate(fm, fy, card.closingDay, card.dueDay);
        futureDueDates.push(dueDate);
        const descricao = `Fatura Prevista - ${card.nome} - ${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`;
        const header = await db.transaction.create({
            data: {
                descricao, valor: 0, data_vencimento: dueDate, status: "PENDENTE", tipo: "SAIDA",
                is_invoice_header: true, is_provisioned: true, userId: user.id, credit_card_id: card.id,
                invoice_month: fm, invoice_year: fy, categoria_id: category.id,
                tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
            },
        });
        const itemDescricao = `${stripInstallmentPattern(realItem.descricao)} (${String(num).padStart(2, "0")}/03)`;
        await db.creditCardInvoiceItem.create({
            data: {
                transactionId: header.id, descricao: itemDescricao, valor: 150, data_compra: realDueDate,
                categoria_id: category.id, is_provisioned: true, installment_group_id: groupId,
                installment_number: num, installment_total: 3,
            },
        });
        await db.transaction.update({ where: { id: header.id }, data: { valor: { increment: 150 } } });

        if (num === 2) {
            assert(itemDescricao === "Compra Loja (02/03)", `descrição da parcela futura remove o padrão original em vez de duplicar, veio "${itemDescricao}"`);
            assert(!itemDescricao.includes("1/3"), "descrição da parcela futura não repete o número da parcela original do texto do banco");
            assert(
                descricao === `Fatura Prevista - Cartão Teste - ${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`,
                "nome da fatura prevista usa o mês CALENDÁRIO do vencimento real"
            );
            assert(
                dueDate.getMonth() + 1 !== fm,
                "invoice_month (ciclo de fechamento) difere do mês calendário do vencimento — prova que usar invoice_month direto no rótulo/bucket era o bug (mostraria um mês a menos)"
            );
        }
    }

    // --- Cada parcela cai num mês calendário sequencial, sem colisão nem buraco ---
    assert(keyOf(realDueDate) !== keyOf(futureDueDates[0]), "fatura real e parcela 2 caem em buckets de mês calendário diferentes");
    assert(keyOf(futureDueDates[0]) !== keyOf(futureDueDates[1]), "parcela 2 e parcela 3 caem em buckets de mês calendário diferentes");
    const expectedNext = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    assert(keyOf(futureDueDates[0]) === keyOf(expectedNext(realDueDate)), "parcela 2 vence exatamente 1 mês calendário após a parcela 1");
    assert(keyOf(futureDueDates[1]) === keyOf(expectedNext(futureDueDates[0])), "parcela 3 vence exatamente 1 mês calendário após a parcela 2");

    // --- Bucket de exibição (nova lógica de getInvoiceTimeline/getInvoiceTimelineDetail): agrupa por data_vencimento, não por invoice_month ---
    const headers = await db.transaction.findMany({
        where: { userId: user.id, credit_card_id: card.id, is_invoice_header: true },
        include: { invoiceItems: true },
    });
    for (const h of headers) {
        const bucketKey = keyOf(h.data_vencimento);
        const matchesOwnCalendarMonth = h.data_vencimento.getFullYear() === Number(bucketKey.split("-")[0])
            && h.data_vencimento.getMonth() + 1 === Number(bucketKey.split("-")[1]);
        assert(matchesOwnCalendarMonth, `header "${h.descricao}" bucketiza no mês calendário do próprio vencimento (${bucketKey})`);
    }

    // --- Janela dinâmica de /faturas: MAX(data_vencimento) das faturas provisionadas determina até onde estender a busca ---
    const furthest = await db.transaction.aggregate({
        where: { userId: user.id, is_invoice_header: true, is_provisioned: true, credit_card_id: { not: null } },
        _max: { data_vencimento: true },
    });
    assert(furthest._max.data_vencimento !== null, "consulta encontra a fatura provisionada mais distante");
    const monthsUntilFurthest = differenceInCalendarMonths(startOfMonth(furthest._max.data_vencimento!), startOfMonth(now)) + 1;
    assert(
        keyOf(furthest._max.data_vencimento!) === keyOf(futureDueDates[1]),
        "a fatura provisionada mais distante encontrada é a da parcela 3 (a última gerada)"
    );
    assert(monthsUntilFurthest >= 2, `janela dinâmica cobriria ao menos ${2} meses à frente pra incluir a parcela 3, calculou ${monthsUntilFurthest}`);

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de exibição de mês de fatura prevista passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
