// Script de integração: simula o novo fluxo de "marcar item do CSV como
// parcelado" (importCreditCardInvoice, src/lib/credit-card-actions.ts) direto
// no banco — replica a mesma lógica de Prisma que o Server Action faz, já que
// getServerSession() não funciona fora de uma requisição HTTP real.
import { PrismaClient } from "@prisma/client";
import {
    computeInvoiceDueDate,
    getReferenceMonthFromDueDate,
    addInvoiceMonths,
} from "../src/lib/credit-card-cycle";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

async function main() {
    const email = "verify-csv-installment-test@example.com";
    await db.user.deleteMany({ where: { email } });

    const user = await db.user.create({ data: { email, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    const card = await db.creditCard.create({
        data: { nome: "Cartão Teste", closingDay: 25, dueDay: 5, institution_id: institution.id, userId: user.id },
    });
    const category = await db.category.create({
        data: { nome: "Fatura Cartão", cor: "#6366f1", icone: "CreditCard", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Cartão (Provisionado)", userId: user.id } });

    // --- 1. Importa a fatura real de agosto/2026, com 1 item marcado como parcela 2/4 ---
    const dueDate = computeInvoiceDueDate(8, 2026, card.closingDay, card.dueDay); // 05/09/2026
    const { month, year } = getReferenceMonthFromDueDate(dueDate, card.closingDay, card.dueDay);
    assert(month === 8 && year === 2026, "vencimento 05/09/2026 (fecha25/vence5) volta pro mês de referência agosto/2026");

    const header = await db.transaction.create({
        data: {
            descricao: "Fatura Agosto",
            valor: 150,
            data_vencimento: dueDate,
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            userId: user.id,
            categoria_id: category.id,
            tipo_pagamento_id: paymentMethod.id,
            institution_id: institution.id,
            credit_card_id: card.id,
            invoice_month: month,
            invoice_year: year,
        },
    });

    const realItem = await db.creditCardInvoiceItem.create({
        data: {
            transactionId: header.id,
            descricao: "Notebook (02/04)",
            valor: 150,
            data_compra: new Date(2026, 6, 27),
            categoria_id: category.id,
        },
    });

    // Replica o loop de geração de parcelas futuras (credit-card-actions.ts)
    const startNum = 2;
    const total = 4;
    const groupId = crypto.randomUUID();

    await db.creditCardInvoiceItem.update({
        where: { id: realItem.id },
        data: { installment_group_id: groupId, installment_number: startNum, installment_total: total },
    });

    const futureHeaderIds: string[] = [];
    for (let num = startNum + 1; num <= total; num++) {
        const offset = num - startNum;
        const { month: fm, year: fy } = addInvoiceMonths(month, year, offset);
        const dueDateFuture = computeInvoiceDueDate(fm, fy, card.closingDay, card.dueDay);
        const futureHeader = await db.transaction.create({
            data: {
                descricao: `Fatura Prevista - ${card.nome} - ${String(fm).padStart(2, "0")}/${fy}`,
                valor: 0,
                data_vencimento: dueDateFuture,
                status: "PENDENTE",
                tipo: "SAIDA",
                is_invoice_header: true,
                is_provisioned: true,
                userId: user.id,
                credit_card_id: card.id,
                invoice_month: fm,
                invoice_year: fy,
                categoria_id: category.id,
                tipo_pagamento_id: paymentMethod.id,
                institution_id: institution.id,
            },
        });
        futureHeaderIds.push(futureHeader.id);
        await db.creditCardInvoiceItem.create({
            data: {
                transactionId: futureHeader.id,
                descricao: `Notebook (${String(num).padStart(2, "0")}/${String(total).padStart(2, "0")})`,
                valor: 150,
                data_compra: new Date(2026, 6, 27),
                categoria_id: category.id,
                is_provisioned: true,
                installment_group_id: groupId,
                installment_number: num,
                installment_total: total,
            },
        });
        await db.transaction.update({ where: { id: futureHeader.id }, data: { valor: { increment: 150 } } });
    }

    // --- 2. Confere o resultado da geração ---
    const realItemAfter = await db.creditCardInvoiceItem.findUnique({ where: { id: realItem.id } });
    assert(
        realItemAfter?.installment_group_id === groupId && realItemAfter?.installment_number === 2 && realItemAfter?.installment_total === 4,
        "item real importado foi carimbado com installment_group_id/number(2)/total(4)"
    );

    const futureHeaders = await db.transaction.findMany({
        where: { userId: user.id, credit_card_id: card.id, is_invoice_header: true, is_provisioned: true },
        include: { invoiceItems: true },
        orderBy: { invoice_month: "asc" },
    });
    assert(futureHeaders.length === 2, `2 faturas projetadas criadas (parcelas 3 e 4), veio ${futureHeaders.length}`);
    assert(
        futureHeaders.map(h => h.invoice_month).join(",") === "9,10",
        "faturas projetadas nos meses corretos (setembro e outubro/2026)"
    );
    assert(
        futureHeaders.every(h => Number(h.valor) === 150),
        "cada fatura projetada tem o mesmo valor do item importado (replicado, não dividido)"
    );

    // --- 3. Reconcilia setembro (simula chegada da fatura real de setembro) ---
    const septemberProvisioned = futureHeaders.find(h => h.invoice_month === 9)!;
    const septemberRealHeader = await db.transaction.create({
        data: {
            descricao: "Fatura Setembro",
            valor: 0,
            data_vencimento: computeInvoiceDueDate(9, 2026, card.closingDay, card.dueDay),
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            userId: user.id,
            categoria_id: category.id,
            tipo_pagamento_id: paymentMethod.id,
            institution_id: institution.id,
            credit_card_id: card.id,
            invoice_month: 9,
            invoice_year: 2026,
        },
    });
    const toCarry = septemberProvisioned.invoiceItems.filter(i => i.installment_group_id !== null);
    const carriedTotal = toCarry.reduce((sum, i) => sum + Number(i.valor), 0);
    await db.creditCardInvoiceItem.updateMany({
        where: { id: { in: toCarry.map(i => i.id) } },
        data: { transactionId: septemberRealHeader.id, is_provisioned: false },
    });
    await db.transaction.update({ where: { id: septemberRealHeader.id }, data: { valor: { increment: carriedTotal } } });
    const remaining = await db.creditCardInvoiceItem.count({ where: { transactionId: septemberProvisioned.id } });
    if (remaining === 0) {
        await db.transaction.delete({ where: { id: septemberProvisioned.id } });
    }

    const septemberProvisionedAfter = await db.transaction.findUnique({ where: { id: septemberProvisioned.id } });
    assert(septemberProvisionedAfter === null, "fatura projetada de setembro foi removida após reconciliar (ficou vazia)");

    const septemberRealAfter = await db.transaction.findUnique({ where: { id: septemberRealHeader.id }, include: { invoiceItems: true } });
    assert(septemberRealAfter!.invoiceItems.length === 1 && Number(septemberRealAfter!.valor) === 150, "parcela 3/4 migrou pra fatura real de setembro");

    const octoberStillProvisioned = await db.transaction.findFirst({
        where: { userId: user.id, credit_card_id: card.id, invoice_month: 10, is_provisioned: true },
    });
    assert(octoberStillProvisioned !== null, "fatura projetada de outubro (parcela 4/4) NÃO foi tocada pela reconciliação de setembro");

    // --- 4. Item marcado como ÚLTIMA parcela (sem parcelas futuras a gerar) ainda deve ser carimbado ---
    // Regressão: a versão paralelizada do loop de geração separou "carimbar o item"
    // de "gerar parcelas futuras" — item sem futuro não pode ficar sem o carimbo.
    const lastInstallmentItem = await db.creditCardInvoiceItem.create({
        data: {
            transactionId: header.id,
            descricao: "Mouse (04/04)",
            valor: 40,
            data_compra: new Date(2026, 6, 27),
            categoria_id: category.id,
        },
    });
    const lastGroupId = crypto.randomUUID();
    const lastStartNum = 4;
    const lastTotal = 4;
    // Réplica do bloco "stamps" (sempre roda) vs. "plan" (só roda se houver parcela futura)
    await db.creditCardInvoiceItem.update({
        where: { id: lastInstallmentItem.id },
        data: { installment_group_id: lastGroupId, installment_number: lastStartNum, installment_total: lastTotal },
    });
    // lastStartNum === lastTotal -> nenhuma parcela futura gerada (loop `num = 5; num <= 4` não roda)

    const lastItemAfter = await db.creditCardInvoiceItem.findUnique({ where: { id: lastInstallmentItem.id } });
    assert(
        lastItemAfter?.installment_group_id === lastGroupId && lastItemAfter?.installment_number === 4 && lastItemAfter?.installment_total === 4,
        "item marcado como última parcela (4/4) é carimbado mesmo sem gerar parcelas futuras"
    );
    const noExtraHeaders = await db.transaction.count({
        where: { userId: user.id, credit_card_id: card.id, is_invoice_header: true, is_provisioned: true, invoice_month: { notIn: [9, 10] } },
    });
    assert(noExtraHeaders === 0, "nenhuma fatura projetada extra foi criada pra uma última parcela (sem parcelas futuras)");

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de import com parcelamento passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
