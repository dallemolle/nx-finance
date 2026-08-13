// Script de integração: valida getNotifications (src/lib/notifications.ts)
// direto no banco — replica a mesma lógica de Prisma, já que a função exige
// sessão HTTP real (getServerSession não funciona fora de uma requisição).
import { PrismaClient } from "@prisma/client";
import { addDays, endOfMonth } from "date-fns";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

// Réplica das 4 queries de getNotifications, pra rodar fora de uma requisição HTTP.
async function getNotifications(userId: string) {
    const now = new Date();
    const [dueSoon, overdue, estimatesPending, invoicesPendingImport] = await Promise.all([
        db.transaction.findMany({
            where: { userId, is_provisioned: false, status: { not: "PAGO" }, data_vencimento: { gte: now, lte: addDays(now, 3) } },
        }),
        db.transaction.findMany({
            where: { userId, is_provisioned: false, status: { not: "PAGO" }, data_vencimento: { lt: now } },
        }),
        db.transaction.findMany({
            where: { userId, is_provisioned: true, credit_card_id: null, data_vencimento: { lte: endOfMonth(now) } },
        }),
        db.transaction.findMany({
            where: { userId, is_invoice_header: true, is_provisioned: true, credit_card_id: { not: null }, data_vencimento: { gte: now, lte: addDays(now, 7) } },
        }),
    ]);
    return { dueSoon, overdue, estimatesPending, invoicesPendingImport };
}

async function main() {
    const email = "verify-notifications-test@example.com";
    await db.user.deleteMany({ where: { email } });

    const user = await db.user.create({ data: { email, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    const card = await db.creditCard.create({
        data: { nome: "Cartão Teste", closingDay: 25, dueDay: 5, institution_id: institution.id, userId: user.id },
    });
    const category = await db.category.create({
        data: { nome: "Contas", cor: "#6366f1", icone: "Wallet", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Débito", userId: user.id } });

    const now = new Date();

    // --- 1. Vencendo em breve (2 dias, PENDENTE) ---
    await db.transaction.create({
        data: {
            descricao: "Conta de luz", valor: 150, data_vencimento: addDays(now, 2), status: "PENDENTE", tipo: "SAIDA",
            userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        },
    });

    // --- 2. Atrasada (ontem, PENDENTE) ---
    await db.transaction.create({
        data: {
            descricao: "Internet", valor: 100, data_vencimento: addDays(now, -1), status: "PENDENTE", tipo: "SAIDA",
            userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        },
    });

    // --- 3. Atrasada mas PAGA — não deve aparecer em nada ---
    await db.transaction.create({
        data: {
            descricao: "Água", valor: 80, data_vencimento: addDays(now, -2), status: "PAGO", data_pagamento: now, tipo: "SAIDA",
            userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        },
    });

    // --- 4. Despesa prevista genérica do mês corrente — deve aparecer em estimate_pending ---
    await db.transaction.create({
        data: {
            descricao: "Mercado (estimativa)", valor: 400, data_vencimento: now, status: "PENDENTE", tipo: "SAIDA",
            is_provisioned: true, userId: user.id, categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        },
    });

    // --- 5. Fatura projetada de cartão vencendo em 5 dias — deve aparecer em invoice_pending_import,
    //        e NÃO em estimate_pending (tem credit_card_id preenchido) ---
    await db.transaction.create({
        data: {
            descricao: "Fatura Prevista - Cartão Teste", valor: 300, data_vencimento: addDays(now, 5), status: "PENDENTE", tipo: "SAIDA",
            is_invoice_header: true, is_provisioned: true, userId: user.id, credit_card_id: card.id,
            invoice_month: now.getMonth() + 1, invoice_year: now.getFullYear(),
            categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
        },
    });

    const result = await getNotifications(user.id);

    assert(result.dueSoon.length === 1 && result.dueSoon[0].descricao === "Conta de luz", "despesa vencendo em 2 dias aparece em due_soon");
    assert(result.overdue.length === 1 && result.overdue[0].descricao === "Internet", "despesa vencida não paga aparece em overdue");
    assert(
        !result.dueSoon.some(t => t.descricao === "Água") && !result.overdue.some(t => t.descricao === "Água"),
        "despesa vencida mas PAGA não aparece em due_soon nem overdue"
    );
    assert(
        result.estimatesPending.length === 1 && result.estimatesPending[0].descricao === "Mercado (estimativa)",
        "despesa prevista genérica do mês corrente aparece em estimate_pending"
    );
    assert(
        !result.estimatesPending.some(t => t.descricao.startsWith("Fatura Prevista")),
        "fatura prevista vinculada a cartão NÃO aparece em estimate_pending (escopo restrito à genérica)"
    );
    assert(
        result.invoicesPendingImport.length === 1 && result.invoicesPendingImport[0].descricao === "Fatura Prevista - Cartão Teste",
        "fatura projetada de cartão vencendo em 5 dias aparece em invoice_pending_import"
    );

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de getNotifications passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
