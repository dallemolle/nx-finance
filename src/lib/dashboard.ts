"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, isBefore, subMonths, addMonths, getDaysInMonth, getMonth, getYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryGroupName } from "./dashboard-utils";

export async function getDashboardData(userId: string, month: number, year: number) {
    const targetDate = new Date(year, month - 1);
    const startDate = startOfMonth(targetDate);
    const endDate = endOfMonth(targetDate);

    const prevMonthDate = subMonths(targetDate, 1);
    const prevStartDate = startOfMonth(prevMonthDate);
    const prevEndDate = endOfMonth(prevMonthDate);

    // Fetch current and previous month transactions
    const [transactions, prevTransactions] = await Promise.all([
        db.transaction.findMany({
            where: { userId, data_vencimento: { gte: startDate, lte: endDate } },
            include: { category: true, institution: true },
            orderBy: { data_vencimento: "desc" },
        }),
        db.transaction.findMany({
            where: { userId, data_vencimento: { gte: prevStartDate, lte: prevEndDate } },
        })
    ]);

    const calculateTotals = (data: any[]) => data.reduce(
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
        .filter((t: any) => t.is_invoice_header)
        .map((t: any) => t.id);

    const invoiceItems = invoiceHeaderIds.length > 0
        ? await db.creditCardInvoiceItem.findMany({
            where: { transactionId: { in: invoiceHeaderIds } },
            include: { category: true },
        })
        : [];

    // Intelligent Category Grouping
    // Merge regular SAIDA transactions (excluding invoice headers) with invoice items
    const categoryData: { name: string; value: number; fill: string }[] = [];

    const aggregateByCategory = (entries: any[]) => {
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
    const regularSaidas = transactions.filter((t: any) => t.tipo === "SAIDA" && !t.is_invoice_header);
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

    // Agrupa invoiceItems por transactionId (apenas itens com header ativo)
    const itemsByHeader = new Map<string, any[]>();
    for (const item of invoiceItems) {
        if (!item.transactionId) continue;
        const list = itemsByHeader.get(item.transactionId) || [];
        list.push({ ...item, valor: Number(item.valor) });
        itemsByHeader.set(item.transactionId, list);
    }

    const monthlyTransactions = transactions.map((t: any) => {
        const isOverdue = t.status !== "PAGO" && isBefore(t.data_vencimento, new Date());
        return {
            ...t,
            valor: Number(t.valor),
            status: isOverdue ? "ATRASADO" : t.status,
            invoiceItems: itemsByHeader.get(t.id)?.map((item: any) => ({
                ...item,
                id: `inv-${item.id}`,
                data_vencimento: item.data_compra,
            })) || [],
        };
    });

    // Mapa de transactions pai para referência ao montar invoiceItems como transações avulsas
    const transactionMap = new Map(transactions.map(t => [t.id, t]));

    // Mapeia invoiceItems para estrutura similar a transação (para o CategoryChart dialog)
    const invoiceItemsAsTransactions = invoiceItems.map((item: any) => {
        const parent = transactionMap.get(item.transactionId);
        return {
            id: `inv-${item.id}`,
            descricao: item.descricao,
            valor: Number(item.valor),
            data_vencimento: item.data_compra,
            status: parent?.status === "PAGO" ? "PAGO" : "PENDENTE",
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
        }
    };
}

export async function getBudgetCommitmentData(userId: string, monthsAhead: number = 12) {
    const now = new Date();
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(addMonths(now, monthsAhead));

    const items = await db.creditCardInvoiceItem.findMany({
        where: {
            data_vencimento_original: {
                gte: startDate,
                lte: endDate,
            },
            category: { userId },
        },
        include: { category: true },
        orderBy: { data_vencimento_original: "asc" },
    });

    const monthMap = new Map<string, { month: number; year: number; label: string; efetivado: number; provisionado: number }>();

    for (let i = 0; i <= monthsAhead; i++) {
        const date = addMonths(startDate, i);
        const m = getMonth(date);
        const y = getYear(date);
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        const label = format(date, "MMM/yy", { locale: ptBR });
        monthMap.set(key, { month: m + 1, year: y, label, efetivado: 0, provisionado: 0 });
    }

    for (const item of items) {
        const d = item.data_vencimento_original || item.data_compra;
        const key = `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key);
        if (entry) {
            const v = Number(item.valor);
            if (item.is_provisioned) {
                entry.provisionado += v;
            } else {
                entry.efetivado += v;
            }
        }
    }

    return Array.from(monthMap.values()).map((entry) => ({
        ...entry,
        efetivado: Math.round(entry.efetivado * 100) / 100,
        provisionado: Math.round(entry.provisionado * 100) / 100,
    }));
}
