"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";

export async function getDashboardData(userId: string, month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const transactions = await db.transaction.findMany({
        where: {
            userId,
            data_vencimento: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            category: true,
        },
        orderBy: {
            data_vencimento: "desc",
        },
    });

    const summary = transactions.reduce(
        (acc: { totalEntradas: number; totalSaidas: number }, t: any) => {
            const valor = Number(t.valor);
            if (t.tipo === "ENTRADA") {
                acc.totalEntradas += valor;
            } else {
                acc.totalSaidas += valor;
            }
            return acc;
        },
        { totalEntradas: 0, totalSaidas: 0 }
    );

    const saldoTotal = summary.totalEntradas - summary.totalSaidas;

    // Pie chart data
    const categoryData = transactions
        .filter((t: any) => t.tipo === "SAIDA")
        .reduce((acc: any[], t: any) => {
            const categoryName = t.category.nome;
            const valor = Number(t.valor);
            const existing = acc.find((item: any) => item.name === categoryName);
            if (existing) {
                existing.value += valor;
            } else {
                acc.push({ name: categoryName, value: valor, fill: t.category.cor });
            }
            return acc;
        }, [] as { name: string; value: number; fill: string }[]);

    const monthlyTransactions = transactions.map((t: any) => {
        // Rule: data_vencimento < today and status != PAID => OVERDUE
        const isOverdue = t.status !== "PAGO" && isBefore(t.data_vencimento, new Date());
        return {
            ...t,
            status: isOverdue ? "ATRASADO" : t.status
        } as any;
    });

    return {
        summary: {
            saldoTotal,
            totalEntradas: summary.totalEntradas,
            totalSaidas: summary.totalSaidas,
        },
        categoryData,
        monthlyTransactions,
    };
} 
