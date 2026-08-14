// Script de integração: valida a lógica de findPossibleDuplicateInstallments
// (src/lib/credit-card-actions.ts) direto no banco — replica a mesma query,
// já que a função exige sessão HTTP real (getServerSession não funciona fora
// de uma requisição).
import { PrismaClient } from "@prisma/client";
import { getMerchantSignature } from "../src/lib/dashboard-utils";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

interface Candidate {
    idx: number;
    descricao: string;
    installmentNumber: number;
    installmentsCount: number;
}

// Réplica de findPossibleDuplicateInstallments, pra rodar fora de uma requisição HTTP.
async function findPossibleDuplicateInstallments(userId: string, creditCardId: string, items: Candidate[]) {
    const candidates = items.filter(i => i.installmentNumber > 1);
    if (candidates.length === 0) return [];

    const totals = [...new Set(candidates.map(i => i.installmentsCount))];
    const existingItems = await db.creditCardInvoiceItem.findMany({
        where: {
            transaction: { userId, credit_card_id: creditCardId },
            installment_total: { in: totals },
            installment_number: { not: null },
        },
        select: { descricao: true, data_compra: true, installment_number: true, installment_total: true },
    });

    const matches: { idx: number; matchDescricao: string; matchDate: Date }[] = [];
    for (const candidate of candidates) {
        const signature = getMerchantSignature(candidate.descricao);
        const match = existingItems.find(e =>
            e.installment_total === candidate.installmentsCount
            && e.installment_number! < candidate.installmentNumber
            && getMerchantSignature(e.descricao) === signature
        );
        if (match) {
            matches.push({ idx: candidate.idx, matchDescricao: match.descricao, matchDate: match.data_compra });
        }
    }
    return matches;
}

async function main() {
    const email = "verify-duplicate-installment-test@example.com";
    await db.user.deleteMany({ where: { email } });

    const user = await db.user.create({ data: { email, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    const card = await db.creditCard.create({
        data: { nome: "Cartão Teste", closingDay: 25, dueDay: 10, institution_id: institution.id, userId: user.id },
    });
    const category = await db.category.create({
        data: { nome: "Fatura Cartão", cor: "#6366f1", icone: "CreditCard", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Cartão (Provisionado)", userId: user.id } });

    // --- Fatura real já importada, com a parcela 1/3 de "Pb*Coffee Mais" ---
    const header = await db.transaction.create({
        data: {
            descricao: "Fatura Julho", valor: 50, data_vencimento: new Date(2026, 6, 10),
            status: "PENDENTE", tipo: "SAIDA", is_invoice_header: true, userId: user.id,
            categoria_id: category.id, tipo_pagamento_id: paymentMethod.id, institution_id: institution.id,
            credit_card_id: card.id, invoice_month: 6, invoice_year: 2026,
        },
    });
    await db.creditCardInvoiceItem.create({
        data: {
            transactionId: header.id, descricao: "Pb*Coffee Mais - Parcela 1/3", valor: 50,
            data_compra: new Date(2026, 6, 10), categoria_id: category.id,
            installment_group_id: crypto.randomUUID(), installment_number: 1, installment_total: 3,
        },
    });

    // --- 1. Reimportação acidental: mesmo estabelecimento, parcela 2/3 ---
    const matches1 = await findPossibleDuplicateInstallments(user.id, card.id, [
        { idx: 0, descricao: "Pb*Coffee Mais - Parcela 2/3", installmentNumber: 2, installmentsCount: 3 },
    ]);
    assert(matches1.length === 1 && matches1[0].matchDescricao === "Pb*Coffee Mais - Parcela 1/3", "detecta possível duplicidade: mesmo estabelecimento, mesmo total, número maior");

    // --- 2. Total de parcelas diferente -> não é a mesma compra, sem match ---
    const matches2 = await findPossibleDuplicateInstallments(user.id, card.id, [
        { idx: 1, descricao: "Pb*Coffee Mais - Parcela 2/5", installmentNumber: 2, installmentsCount: 5 },
    ]);
    assert(matches2.length === 0, "não detecta duplicidade quando o total de parcelas é diferente");

    // --- 3. Estabelecimento diferente, mesmo total/número -> sem match ---
    const matches3 = await findPossibleDuplicateInstallments(user.id, card.id, [
        { idx: 2, descricao: "Amazon BR V - Parcela 2/3", installmentNumber: 2, installmentsCount: 3 },
    ]);
    assert(matches3.length === 0, "não detecta duplicidade quando a assinatura do estabelecimento não bate");

    // --- 4. Parcela 1 nunca dispara a checagem (é o caso normal de começar do zero) ---
    const matches4 = await findPossibleDuplicateInstallments(user.id, card.id, [
        { idx: 3, descricao: "Pb*Coffee Mais - Parcela 1/3", installmentNumber: 1, installmentsCount: 3 },
    ]);
    assert(matches4.length === 0, "parcela nº 1 nunca é candidata a duplicidade");

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de detecção de duplicidade de parcela passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
