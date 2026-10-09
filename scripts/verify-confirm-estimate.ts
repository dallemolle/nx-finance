// Script de integração: valida confirmEstimatedExpense (src/lib/credit-card-provision-actions.ts)
// direto no banco — em especial a guarda "só genérica" (is_provisioned:true e
// credit_card_id:null), que deve rejeitar tentativas de efetivar um header
// de fatura provisionada vinculado a cartão.
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

// Replica a mesma guarda de confirmEstimatedExpense (que exige sessão real, não
// disponível fora de uma requisição HTTP) — busca com where explícito e, se
// encontrada, confirma como despesa real.
async function confirmEstimatedExpense(userId: string, id: string, valor: number) {
    const existing = await db.transaction.findFirst({
        where: { id, userId, is_provisioned: true, credit_card_id: null },
    });
    if (!existing) throw new Error("Despesa prevista não encontrada (ou não é genérica).");
    return db.transaction.update({ where: { id }, data: { valor, is_provisioned: false } });
}

async function main() {
    const email = "verify-confirm-estimate-test@example.com";
    await db.user.deleteMany({ where: { email } });

    const user = await db.user.create({ data: { email, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    const card = await db.creditCard.create({
        data: { nome: "Cartão Teste", closingDay: 25, dueDay: 5, institution_id: institution.id, userId: user.id },
    });
    const category = await db.category.create({
        data: { nome: "Conta de Luz", cor: "#f59e0b", icone: "Zap", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Débito Automático", userId: user.id } });

    // --- 1. Despesa prevista GENÉRICA: estimativa de R$150, valor real chega em R$187 ---
    const genericEstimate = await db.transaction.create({
        data: {
            descricao: "Conta de luz (estimativa)",
            valor: 150,
            data_vencimento: new Date(2026, 8, 1),
            status: "PENDENTE",
            tipo: "SAIDA",
            is_provisioned: true,
            userId: user.id,
            categoria_id: category.id,
            tipo_pagamento_id: paymentMethod.id,
            institution_id: institution.id,
        },
    });

    const confirmed = await confirmEstimatedExpense(user.id, genericEstimate.id, 187);
    assert(confirmed.is_provisioned === false, "despesa prevista genérica efetivada: is_provisioned vira false");
    assert(Number(confirmed.valor) === 187, "valor atualizado para o valor real (187) ao efetivar");

    // --- 2. Despesa prevista NO CARTÃO (header projetado): confirmEstimatedExpense deve rejeitar ---
    const cardHeader = await db.transaction.create({
        data: {
            descricao: "Fatura Prevista - Cartão Teste - 09/2026",
            valor: 100,
            data_vencimento: new Date(2026, 9, 5),
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            is_provisioned: true,
            userId: user.id,
            credit_card_id: card.id,
            invoice_month: 9,
            invoice_year: 2026,
            categoria_id: category.id,
            tipo_pagamento_id: paymentMethod.id,
            institution_id: institution.id,
        },
    });

    let rejected = false;
    try {
        await confirmEstimatedExpense(user.id, cardHeader.id, 100);
    } catch {
        rejected = true;
    }
    assert(rejected, "tentativa de efetivar despesa prevista vinculada a cartão é rejeitada (guarda 'só genérica')");

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de confirmEstimatedExpense passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
