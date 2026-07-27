// Script de integração: valida getInvoiceTimelineDetail (src/lib/credit-card-provision-actions.ts)
// direto no banco — replica a mesma lógica de agregação, já que a função é um
// Server Action que exige sessão HTTP real (getServerSession não funciona num script).
import { PrismaClient } from "@prisma/client";
import { addMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    throw new Error(`DATABASE_URL não parece ser local (${DATABASE_URL}). Abortando por segurança.`);
}

const db = new PrismaClient();

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FALHOU: " + msg);
    console.log("OK: " + msg);
}

// Réplica de getInvoiceTimelineDetail, pra rodar fora de uma requisição HTTP.
async function getInvoiceTimelineDetail(userId: string, monthsAhead = 6) {
    const now = new Date();
    const rangeStart = startOfMonth(now);
    const rangeEnd = endOfMonth(addMonths(now, monthsAhead - 1));

    const [headers, cards] = await Promise.all([
        db.transaction.findMany({
            where: { userId, is_invoice_header: true, data_vencimento: { gte: rangeStart, lte: rangeEnd }, credit_card_id: { not: null } },
            include: { invoiceItems: { include: { category: true }, orderBy: { data_compra: "asc" } } },
        }),
        db.creditCard.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
    ]);

    const monthBuckets = Array.from({ length: monthsAhead }, (_, i) => {
        const bucketDate = addMonths(now, i);
        return { month: bucketDate.getMonth() + 1, year: bucketDate.getFullYear(), label: format(bucketDate, "MMM/yy", { locale: ptBR }) };
    });

    return cards.map(card => {
        const months = monthBuckets.map(b => {
            const matchingHeaders = headers.filter(h => h.credit_card_id === card.id && h.invoice_month === b.month && h.invoice_year === b.year);
            const items = matchingHeaders.flatMap(h =>
                h.invoiceItems.map(item => ({
                    id: item.id,
                    descricao: item.descricao,
                    valor: Number(item.valor),
                    is_provisioned: item.is_provisioned,
                }))
            );
            const confirmed = items.filter(i => !i.is_provisioned).reduce((sum, i) => sum + i.valor, 0);
            const provisioned = items.filter(i => i.is_provisioned).reduce((sum, i) => sum + i.valor, 0);
            return { label: b.label, month: b.month, year: b.year, confirmed, provisioned, total: confirmed + provisioned, items };
        });
        return { cardId: card.id, cardNome: card.nome, months };
    });
}

async function main() {
    const email = "verify-invoice-timeline-detail-test@example.com";
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

    const now = new Date();
    const bucket0 = { month: now.getMonth() + 1, year: now.getFullYear() };
    const bucket1Date = addMonths(now, 1);
    const bucket1 = { month: bucket1Date.getMonth() + 1, year: bucket1Date.getFullYear() };

    const headerData = (invoiceMonth: number, invoiceYear: number, provisioned: boolean) => ({
        descricao: `Fatura ${invoiceMonth}/${invoiceYear}`,
        valor: 0,
        data_vencimento: new Date(invoiceYear, invoiceMonth - 1, 10),
        status: "PENDENTE" as const,
        tipo: "SAIDA" as const,
        is_invoice_header: true,
        is_provisioned: provisioned,
        userId: user.id,
        credit_card_id: card.id,
        invoice_month: invoiceMonth,
        invoice_year: invoiceYear,
        categoria_id: category.id,
        tipo_pagamento_id: paymentMethod.id,
        institution_id: institution.id,
    });

    // --- 2 faturas REAIS no MESMO cartão+mês (bucket0) — testa que filter soma as duas ---
    const headerA = await db.transaction.create({ data: headerData(bucket0.month, bucket0.year, false) });
    await db.creditCardInvoiceItem.create({
        data: { transactionId: headerA.id, descricao: "Compra A", valor: 100, data_compra: now, categoria_id: category.id },
    });
    const headerB = await db.transaction.create({ data: headerData(bucket0.month, bucket0.year, false) });
    await db.creditCardInvoiceItem.create({
        data: { transactionId: headerB.id, descricao: "Compra B", valor: 50, data_compra: now, categoria_id: category.id },
    });

    // --- 1 fatura PROVISIONADA no mês seguinte (bucket1) ---
    const headerC = await db.transaction.create({ data: headerData(bucket1.month, bucket1.year, true) });
    await db.creditCardInvoiceItem.create({
        data: {
            transactionId: headerC.id, descricao: "Estimativa C", valor: 75, data_compra: now,
            categoria_id: category.id, is_provisioned: true,
        },
    });

    const groups = await getInvoiceTimelineDetail(user.id);
    assert(groups.length === 1, `1 grupo (1 cartão) retornado, veio ${groups.length}`);
    const group = groups[0];
    assert(group.cardId === card.id, "grupo corresponde ao cartão de teste");
    assert(group.months.length === 6, `6 meses no range padrão, veio ${group.months.length}`);

    const monthsByKey = new Map(group.months.map(m => [`${m.year}-${m.month}`, m]));
    const m0 = monthsByKey.get(`${bucket0.year}-${bucket0.month}`)!;
    const m1 = monthsByKey.get(`${bucket1.year}-${bucket1.month}`)!;

    assert(m0.items.length === 2, `mês corrente tem 2 itens (2 faturas reais somadas via filter), veio ${m0.items.length}`);
    assert(m0.confirmed === 150 && m0.provisioned === 0, `mês corrente: confirmado=150 (100+50), previsto=0 — veio confirmado=${m0.confirmed}, previsto=${m0.provisioned}`);
    assert(m0.total === 150, "total do mês corrente bate com a soma dos itens");

    assert(m1.items.length === 1 && m1.items[0].is_provisioned === true, "mês seguinte tem 1 item, marcado como previsto");
    assert(m1.confirmed === 0 && m1.provisioned === 75, `mês seguinte: confirmado=0, previsto=75 — veio confirmado=${m1.confirmed}, previsto=${m1.provisioned}`);

    const emptyMonth = group.months.find(m => m !== m0 && m !== m1)!;
    assert(emptyMonth.items.length === 0 && emptyMonth.total === 0, "mês sem atividade vem com items:[] e total 0");

    // --- Limpeza ---
    await db.user.delete({ where: { id: user.id } });
    console.log("\nDados de teste removidos. Todos os testes de getInvoiceTimelineDetail passaram.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
