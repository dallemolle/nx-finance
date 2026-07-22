"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, isBefore, subMonths, getDaysInMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryGroupName } from "./dashboard-utils";
import type { Prisma, TransactionType } from "@prisma/client";

interface TotalsEntry {
    tipo: TransactionType;
    valor: Prisma.Decimal;
}

interface CategorizedEntry {
    valor: Prisma.Decimal;
    category: { nome: string; cor: string };
}

export async function getDashboardData(userId: string, month: number, year: number) {
    const targetDate = new Date(year, month - 1);
    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    const prevMonthDate = subMonths(targetDate, 1);
    const prevStartDate = startOfMonth(prevMonthDate);
    const prevEndDate = endOfMonth(prevMonthDate);

    // Fetch current and previous month transactions
    const [transactions, prevTransactions, firstTransaction] = await Promise.all([
        db.transaction.findMany({
            where: { userId, data_vencimento: { gte: startDate, lte: endDate } },
            include: { category: true, institution: true },
            orderBy: { data_vencimento: "desc" },
        }),
        db.transaction.findMany({
            where: { userId, data_vencimento: { gte: prevStartDate, lte: prevEndDate } },
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

    const calculateDelta = (curr: number, prev: number) => {
        if (prev === 0) return 0;
        return ((curr - prev) / prev) * 100;
    };

    const saldoTotal = currentSummary.totalEntradas - currentSummary.totalSaidas;

    // Fetch invoice items for invoice headers in the current period
    const invoiceHeaderIds = transactions
        .filter(t => t.is_invoice_header)
        .map(t => t.id);

    const invoiceItems = invoiceHeaderIds.length > 0
        ? await db.creditCardInvoiceItem.findMany({
            where: { transactionId: { in: invoiceHeaderIds } },
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
    const isCurrentMonth = today.getMonth() === targetDate.getMonth() && today.getFullYear() === targetDate.getFullYear();
    const daysPassed = isCurrentMonth ? today.getDate() : getDaysInMonth(targetDate);
    const dailyAverage = currentSummary.totalSaidas / daysPassed;
    const forecast = dailyAverage * getDaysInMonth(targetDate);

    const healthScore = currentSummary.totalEntradas > 0
        ? (currentSummary.totalSaidas / currentSummary.totalEntradas) * 100
        : currentSummary.totalSaidas > 0 ? 100 : 0;

    // Agrupa invoiceItems por transactionId
    const itemsByHeader = new Map<string, (Omit<typeof invoiceItems[number], "valor"> & { valor: number })[]>();
    for (const item of invoiceItems) {
        const list = itemsByHeader.get(item.transactionId) || [];
        list.push({ ...item, valor: Number(item.valor) });
        itemsByHeader.set(item.transactionId, list);
    }

    const monthlyTransactions = transactions.map(t => {
        const isOverdue = t.status !== "PAGO" && isBefore(t.data_vencimento, new Date());
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

    return {
        summary: {
            saldoTotal,
            totalEntradas: currentSummary.totalEntradas,
            totalSaidas: currentSummary.totalSaidas,
            deltaEntradas: calculateDelta(currentSummary.totalEntradas, prevSummary.totalEntradas),
            deltaSaidas: calculateDelta(currentSummary.totalSaidas, prevSummary.totalSaidas),
            deltaSaldo: calculateDelta(saldoTotal, prevSummary.totalEntradas - prevSummary.totalSaidas),
        },
        categoryData,
        monthlyTransactions: [...monthlyTransactions, ...invoiceItemsAsTransactions],
        metrics: {
            forecast,
            healthScore,
            daysPassed,
            totalDays: getDaysInMonth(targetDate)
        },
        hasAnyTransactions,
    };
}

const TREND_MONTHS_COUNT = 6;

export async function getMonthlyTrend(userId: string, month: number, year: number) {
    const targetDate = new Date(year, month - 1);
    const rangeStart = startOfMonth(subMonths(targetDate, TREND_MONTHS_COUNT - 1));
    const rangeEnd = endOfMonth(targetDate);

    const transactions = await db.transaction.findMany({
        where: { userId, data_vencimento: { gte: rangeStart, lte: rangeEnd } },
        select: { valor: true, tipo: true, data_vencimento: true },
    });

    const buckets = Array.from({ length: TREND_MONTHS_COUNT }, (_, i) => {
        const bucketDate = subMonths(targetDate, TREND_MONTHS_COUNT - 1 - i);
        return {
            key: `${bucketDate.getFullYear()}-${bucketDate.getMonth()}`,
            label: format(bucketDate, "MMM", { locale: ptBR }),
            totalEntradas: 0,
            totalSaidas: 0,
        };
    });
    const bucketByKey = new Map(buckets.map(b => [b.key, b]));

    for (const t of transactions) {
        const key = `${t.data_vencimento.getFullYear()}-${t.data_vencimento.getMonth()}`;
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
