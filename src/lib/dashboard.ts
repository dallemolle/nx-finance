"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, isBefore, subMonths, getDaysInMonth } from "date-fns";
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

    const monthlyTransactions = transactions.map((t: any) => {
        const isOverdue = t.status !== "PAGO" && isBefore(t.data_vencimento, new Date());
        return {
            ...t,
            valor: Number(t.valor),
            status: isOverdue ? "ATRASADO" : t.status
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
        monthlyTransactions,
        metrics: {
            forecast,
            healthScore,
            daysPassed,
            totalDays: getDaysInMonth(targetDate)
        }
    };
}
