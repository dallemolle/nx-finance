"use server";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";

export async function getDashboardData(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

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
    });

    const summary = transactions.reduce(
        (acc, t) => {
            const val = Number(t.valor);
            if (t.tipo === "ENTRADA") acc.income += val;
            else acc.expenses += val;
            return acc;
        },
        { income: 0, expenses: 0 }
    );

    const categoryMap = transactions.reduce((acc: any, t) => {
        if (t.tipo === "SAIDA") {
            const cat = t.category.nome;
            acc[cat] = (acc[cat] || 0) + Number(t.valor);
        }
        return acc;
    }, {});

    const categoryData = Object.entries(categoryMap).map(([name, value]) => ({
        name,
        value,
        color: transactions.find(t => t.category.nome === name)?.category.cor || "#cbd5e1"
    }));

    const latestTransactions = await db.transaction.findMany({
        where: { userId },
        take: 5,
        orderBy: { data_lancamento: "desc" },
        include: { category: true }
    });

    return {
        summary: {
            ...summary,
            balance: summary.income - summary.expenses
        },
        categoryData,
        latestTransactions
    };
}
