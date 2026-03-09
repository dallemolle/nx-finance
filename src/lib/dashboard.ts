"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, isBefore, subMonths, getDaysInMonth } from "date-fns";

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
            include: { category: true },
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

    // Intelligent Category Grouping
    const groupName = (name: string) => {
        const n = name.toLowerCase().trim();
        if (n.startsWith("mercado") || n.startsWith("mer")) return "Mercado";
        if (n.startsWith("comida") || n.startsWith("restaurante") || n.startsWith("ifood")) return "Alimentação";
        return name;
    };

    const categoryData = transactions
        .filter((t: any) => t.tipo === "SAIDA")
        .reduce((acc: any[], t: any) => {
            const name = groupName(t.category.nome);
            const valor = Number(t.valor);
            const existing = acc.find((item: any) => item.name === name);

            // Premium Color Palette overrides
            let fill = t.category.cor;
            if (name === "Mercado") fill = "#0d9488"; // teal-600
            if (name === "Alimentação") fill = "#0891b2"; // cyan-600

            if (existing) {
                existing.value += valor;
            } else {
                acc.push({ name, value: valor, fill });
            }
            return acc;
        }, [] as { name: string; value: number; fill: string }[]);

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
        return { ...t, status: isOverdue ? "ATRASADO" : t.status };
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
