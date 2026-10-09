// Script de integração: simula o ciclo completo de provisionamento +
// conciliação diretamente no banco (não chama as Server Actions, que exigem
// sessão HTTP real — replica exatamente as mesmas operações de Prisma que
// provisionCardInstallmentPurchase / reconcileProvisionedInstallments fazem).
import { PrismaClient } from "@prisma/client";
import { Decimal } from "decimal.js";
import {
    getInvoiceReferenceMonth,
    addInvoiceMonths,
    computeInvoiceDueDate,
    splitInstallments,
} from "../src/lib/credit-card-cycle";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    // Segurança: nunca rodar isso contra staging/produção.
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

async function main() {
    const email = "verify-reconciliation-test@example.com";

    // Limpeza de execução anterior, se houver
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

    // --- 1. Provisiona uma compra de R$300,00 em 3x, feita em 27/07/2026 (fecha dia 25) ---
    const purchaseDate = new Date(2026, 6, 27);
    const installments = splitInstallments(new Decimal("300.00"), 3);
    const reference = getInvoiceReferenceMonth(purchaseDate, card.closingDay);
    assert(reference.month === 8 && reference.year === 2026, "compra de 27/07 cai na fatura de referência agosto/2026");

    const installmentGroupId = crypto.randomUUID();
    const headerIds: string[] = [];

    for (let i = 0; i < installments.length; i++) {
        const { month, year } = addInvoiceMonths(reference.month, reference.year, i);
        const dueDate = computeInvoiceDueDate(month, year, card.closingDay, card.dueDay);

        const header = await db.transaction.create({
            data: {
                descricao: `Fatura Prevista - ${card.nome} - ${String(month).padStart(2, "0")}/${year}`,
                valor: 0,
                data_vencimento: dueDate,
                status: "PENDENTE",
                tipo: "SAIDA",
                is_invoice_header: true,
                is_provisioned: true,
                userId: user.id,
                credit_card_id: card.id,
                invoice_month: month,
                invoice_year: year,
                categoria_id: category.id,
                tipo_pagamento_id: paymentMethod.id,
                institution_id: institution.id,
            },
        });
        headerIds.push(header.id);

        const value = installments[i].value;
        await db.creditCardInvoiceItem.create({
            data: {
                transactionId: header.id,
                descricao: `Notebook (${String(i + 1).padStart(2, "0")}/03)`,
                valor: value.toNumber(),
                data_compra: purchaseDate,
                categoria_id: category.id,
                is_provisioned: true,
                installment_group_id: installmentGroupId,
                installment_number: i + 1,
                installment_total: 3,
            },
        });
        await db.transaction.update({ where: { id: header.id }, data: { valor: { increment: value.toNumber() } } });
    }

    const provisionedHeaders = await db.transaction.findMany({
        where: { userId: user.id, credit_card_id: card.id, is_invoice_header: true, is_provisioned: true },
        include: { invoiceItems: true },
        orderBy: { invoice_month: "asc" },
    });
    assert(provisionedHeaders.length === 3, `3 faturas projetadas criadas (agosto/setembro/outubro), veio ${provisionedHeaders.length}`);
    assert(
        provisionedHeaders.map(h => h.invoice_month).join(",") === "8,9,10",
        "faturas projetadas nos meses corretos (8,9,10)"
    );
    const totalProvisioned = provisionedHeaders.reduce((sum, h) => sum + Number(h.valor), 0);
    assert(Math.abs(totalProvisioned - 300) < 0.001, `soma das 3 faturas projetadas = R$300,00, veio ${totalProvisioned}`);

    // --- 2. Simula a chegada da fatura REAL de agosto/2026 (import de CSV) ---
    const realHeader = await db.transaction.create({
        data: {
            descricao: "Fatura Agosto",
            valor: 50, // 1 item manual do CSV, a parcela provisionada será somada depois
            data_vencimento: computeInvoiceDueDate(8, 2026, card.closingDay, card.dueDay),
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            is_provisioned: false,
            userId: user.id,
            credit_card_id: card.id,
            invoice_month: 8,
            invoice_year: 2026,
            categoria_id: category.id,
            tipo_pagamento_id: paymentMethod.id,
            institution_id: institution.id,
        },
    });
    await db.creditCardInvoiceItem.create({
        data: {
            transactionId: realHeader.id,
            descricao: "Mercado",
            valor: 50,
            data_compra: new Date(2026, 7, 10),
            categoria_id: category.id,
        },
    });

    // Reconciliação (replica reconcileProvisionedInstallments)
    const augustProvisioned = provisionedHeaders.find(h => h.invoice_month === 8)!;
    const toCarry = augustProvisioned.invoiceItems.filter(i => i.installment_group_id !== null);
    const carriedTotal = toCarry.reduce((sum, i) => sum + Number(i.valor), 0);
    await db.creditCardInvoiceItem.updateMany({
        where: { id: { in: toCarry.map(i => i.id) } },
        data: { transactionId: realHeader.id, is_provisioned: false },
    });
    await db.transaction.update({ where: { id: realHeader.id }, data: { valor: { increment: carriedTotal } } });
    const remaining = await db.creditCardInvoiceItem.count({ where: { transactionId: augustProvisioned.id } });
    if (remaining === 0) {
        await db.transaction.delete({ where: { id: augustProvisioned.id } });
    }

    // --- 3. Confere o resultado da conciliação ---
    const augustStillProvisioned = await db.transaction.findUnique({ where: { id: augustProvisioned.id } });
    assert(augustStillProvisioned === null, "fatura projetada de agosto foi removida após a conciliação (ficou vazia)");

    const realHeaderAfter = await db.transaction.findUnique({ where: { id: realHeader.id }, include: { invoiceItems: true } });
    assert(realHeaderAfter !== null, "fatura real de agosto ainda existe");
    assert(realHeaderAfter!.invoiceItems.length === 2, `fatura real tem 2 itens (1 manual + 1 parcela migrada), veio ${realHeaderAfter!.invoiceItems.length}`);
    assert(
        realHeaderAfter!.invoiceItems.every(i => !i.is_provisioned),
        "todos os itens da fatura real estão marcados como não-provisionados"
    );
    assert(Math.abs(Number(realHeaderAfter!.valor) - 150) < 0.001, `valor da fatura real = 50 (manual) + 100 (parcela) = 150, veio ${Number(realHeaderAfter!.valor)}`);

    const septemberStillProvisioned = await db.transaction.findFirst({
        where: { userId: user.id, credit_card_id: card.id, invoice_month: 9, is_provisioned: true },
    });
    assert(septemberStillProvisioned !== null, "fatura projetada de setembro NÃO foi tocada pela conciliação de agosto");

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de reconciliação passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
