"use server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { currentMonthInAppZone, dateOnlyParts, daysInMonth, monthRange, todayDateOnly } from "./date-only";
import { getCategoryGroupName } from "./dashboard-utils";
import { incomeCommitmentPercent, percentChange, projectMonthlyOutflow } from "./dashboard-metrics";
import type { Prisma, TransactionType } from "@prisma/client";

interface TotalsEntry {
    tipo: TransactionType;
    valor: Prisma.Decimal;
}

interface CategorizedEntry {
    valor: Prisma.Decimal;
    category: { nome: string; cor: string };
}

export async function getDashboardData(month: number, year: number) {
    const userId = await getSessionUserId();
    const range = monthRange(year, month);
    const prevRange = monthRange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

    // Fetch current and previous month transactions
    // is_provisioned:false exclui faturas/despesas projetadas para meses futuros
    // (ver credit-card-provision-actions.ts) — elas não são gasto real ainda.
    const [transactions, prevTransactions, firstTransaction] = await Promise.all([
        db.transaction.findMany({
            where: { userId, data_vencimento: range, is_provisioned: false },
            include: { category: true, institution: true },
            orderBy: { data_vencimento: "desc" },
        }),
        db.transaction.findMany({
            where: { userId, data_vencimento: prevRange, is_provisioned: false },
        }),
        db.transaction.findFirst({ where: { userId }, select: { id: true } }),
    ]);

    const hasAnyTransactions = !!firstTransaction;

    const calculateTotals = (data: TotalsEntry[]) => data.reduce(
        (acc, t) => {
            const valor = Number(t.valor);
            if (t.tipo === "ENTRADA") acc.totalEntradas += valor;
            else acc.totalSaidas += valor;
            return acc;
        },
        { totalEntradas: 0, totalSaidas: 0 }
    );

    const currentSummary = calculateTotals(transactions);
    const prevSummary = calculateTotals(prevTransactions);


    const saldoTotal = currentSummary.totalEntradas - currentSummary.totalSaidas;

    // Fetch invoice items for invoice headers in the current period
    const invoiceHeaderIds = transactions
        .filter(t => t.is_invoice_header)
        .map(t => t.id);

    const invoiceItems = invoiceHeaderIds.length > 0
        ? await db.creditCardInvoiceItem.findMany({
            where: { transactionId: { in: invoiceHeaderIds }, is_provisioned: false },
            include: { category: true },
        })
        : [];

    // Intelligent Category Grouping
    // Merge regular SAIDA transactions (excluding invoice headers) with invoice items
    const categoryData: { name: string; value: number; fill: string }[] = [];

    const aggregateByCategory = (entries: CategorizedEntry[]) => {
        for (const entry of entries) {
            const name = getCategoryGroupName(entry.category.nome);
            const valor = Number(entry.valor);
            const existing = categoryData.find(item => item.name === name);
            if (existing) {
                existing.value += valor;
            } else {
                categoryData.push({ name, value: valor, fill: entry.category.cor });
            }
        }
    };

    // 1. Regular transactions (skip invoice headers to avoid double-count in chart)
    const regularSaidas = transactions.filter(t => t.tipo === "SAIDA" && !t.is_invoice_header);
    aggregateByCategory(regularSaidas);

    // 2. Invoice items (detailed breakdown of credit card invoices)
    aggregateByCategory(invoiceItems);

    // Monthly Forecast & Health
    const today = new Date();
    const current = currentMonthInAppZone(today);
    const isCurrentMonth = current.month === month && current.year === year;
    const totalDays = daysInMonth(year, month);
    const daysPassed = isCurrentMonth ? dateOnlyParts(todayDateOnly(today)).day : totalDays;
    const forecast = projectMonthlyOutflow({
        saidas: transactions
            .filter(t => t.tipo === "SAIDA")
            .map(t => ({ valor: Number(t.valor), data: t.data_vencimento })),
        today,
        month,
        year,
    });

    const healthScore = incomeCommitmentPercent(currentSummary.totalSaidas, currentSummary.totalEntradas);

    // Agrupa invoiceItems por transactionId
    const itemsByHeader = new Map<string, (Omit<typeof invoiceItems[number], "valor"> & { valor: number })[]>();
    for (const item of invoiceItems) {
        const list = itemsByHeader.get(item.transactionId) || [];
        list.push({ ...item, valor: Number(item.valor) });
        itemsByHeader.set(item.transactionId, list);
    }

    const monthlyTransactions = transactions.map(t => {
        const isOverdue = t.status !== "PAGO" && t.data_vencimento < todayDateOnly();
        return {
            ...t,
            valor: Number(t.valor),
            status: isOverdue ? "ATRASADO" as const : t.status,
            invoiceItems: itemsByHeader.get(t.id)?.map(item => ({
                ...item,
                id: `inv-${item.id}`,
                data_vencimento: item.data_compra,
            })) || [],
        };
    });

    // Mapa de transactions pai para referência ao montar invoiceItems como transações avulsas
    const transactionMap = new Map(transactions.map(t => [t.id, t]));

    // Mapeia invoiceItems para estrutura similar a transação (para o CategoryChart dialog)
    const invoiceItemsAsTransactions = invoiceItems.map(item => {
        const parent = transactionMap.get(item.transactionId);
        return {
            id: `inv-${item.id}`,
            descricao: item.descricao,
            valor: Number(item.valor),
            data_vencimento: item.data_compra,
            status: parent?.status === "PAGO" ? "PAGO" as const : "PENDENTE" as const,
            tipo: "SAIDA" as const,
            categoria_id: item.categoria_id,
            category: item.category,
            institution: parent?.institution || null,
            paymentMethod: null,
            isInvoiceItem: true,
        };
    });

    // Busca lançamentos previstos (is_provisioned:true) do mesmo período, só para
    // exibição nas listas (badge "Previsto") — NÃO entram em categoryData/summary/
    // forecast/healthScore acima, que continuam derivando só do confirmado.
    const provisionedTransactions = await db.transaction.findMany({
        where: { userId, data_vencimento: range, is_provisioned: true },
        include: { category: true, institution: true },
        orderBy: { data_vencimento: "desc" },
    });

    const provisionedHeaderIds = provisionedTransactions.filter(t => t.is_invoice_header).map(t => t.id);
    const provisionedInvoiceItems = provisionedHeaderIds.length > 0
        ? await db.creditCardInvoiceItem.findMany({
            where: { transactionId: { in: provisionedHeaderIds }, is_provisioned: true },
            include: { category: true },
        })
        : [];

    const provisionedItemsByHeader = new Map<string, (Omit<typeof provisionedInvoiceItems[number], "valor"> & { valor: number })[]>();
    for (const item of provisionedInvoiceItems) {
        const list = provisionedItemsByHeader.get(item.transactionId) || [];
        list.push({ ...item, valor: Number(item.valor) });
        provisionedItemsByHeader.set(item.transactionId, list);
    }

    const provisionedRows = provisionedTransactions.map(t => ({
        ...t,
        valor: Number(t.valor),
        invoiceItems: provisionedItemsByHeader.get(t.id)?.map(item => ({
            ...item,
            id: `inv-${item.id}`,
            data_vencimento: item.data_compra,
        })) || [],
    }));

    const provisionedTransactionMap = new Map(provisionedTransactions.map(t => [t.id, t]));
    const provisionedItemsAsTransactions = provisionedInvoiceItems.map(item => {
        const parent = provisionedTransactionMap.get(item.transactionId);
        return {
            id: `inv-${item.id}`,
            descricao: item.descricao,
            valor: Number(item.valor),
            data_vencimento: item.data_compra,
            status: "PENDENTE" as const,
            tipo: "SAIDA" as const,
            categoria_id: item.categoria_id,
            category: item.category,
            institution: parent?.institution || null,
            paymentMethod: null,
            isInvoiceItem: true,
            is_provisioned: true,
        };
    });

    return {
        summary: {
            saldoTotal,
            totalEntradas: currentSummary.totalEntradas,
            totalSaidas: currentSummary.totalSaidas,
            deltaEntradas: percentChange(currentSummary.totalEntradas, prevSummary.totalEntradas),
            deltaSaidas: percentChange(currentSummary.totalSaidas, prevSummary.totalSaidas),
            deltaSaldo: percentChange(saldoTotal, prevSummary.totalEntradas - prevSummary.totalSaidas),
        },
        categoryData,
        monthlyTransactions: [...monthlyTransactions, ...invoiceItemsAsTransactions, ...provisionedRows, ...provisionedItemsAsTransactions],
        metrics: {
            forecast,
            healthScore,
            daysPassed,
            totalDays
        },
        hasAnyTransactions,
    };
}

const TREND_MONTHS_COUNT = 6;

export async function getMonthlyTrend(month: number, year: number) {
    const userId = await getSessionUserId();
    // Meses do mais antigo ao mês pedido, sempre pelo dia do calendário (UTC).
    const months = Array.from({ length: TREND_MONTHS_COUNT }, (_, i) => {
        const total = year * 12 + (month - 1) - (TREND_MONTHS_COUNT - 1 - i);
        return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });

    const transactions = await db.transaction.findMany({
        where: { userId, data_vencimento: { gte: monthRange(months[0].year, months[0].month).gte, lt: monthRange(year, month).lt }, is_provisioned: false },
        select: { valor: true, tipo: true, data_vencimento: true },
    });

    const buckets = months.map(m => {
        return {
            key: `${m.year}-${m.month}`,
            label: format(new Date(m.year, m.month - 1, 1), "MMM", { locale: ptBR }),
            totalEntradas: 0,
            totalSaidas: 0,
        };
    });
    const bucketByKey = new Map(buckets.map(b => [b.key, b]));

    for (const t of transactions) {
        const { year: y, month: m } = dateOnlyParts(t.data_vencimento);
        const key = `${y}-${m}`;
        const bucket = bucketByKey.get(key);
        if (!bucket) continue;
        if (t.tipo === "ENTRADA") bucket.totalEntradas += Number(t.valor);
        else bucket.totalSaidas += Number(t.valor);
    }

    return buckets.map(b => ({
        label: b.label,
        saldo: b.totalEntradas - b.totalSaidas,
    }));
}
