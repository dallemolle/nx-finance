"use server";

import { db } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function getReportData(userId: string, month: number, year: number, filters?: any) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const where: any = {
        userId,
        data_vencimento: {
            gte: startDate,
            lte: endDate,
        },
    };

    if (filters?.status && filters.status !== "ALL") where.status = filters.status;
    if (filters?.categoria_id && filters.categoria_id !== "ALL") where.categoria_id = filters.categoria_id;

    const transactions = await db.transaction.findMany({
        where,
        include: {
            category: true,
            paymentMethod: true,
        },
        orderBy: {
            data_vencimento: "desc",
        },
    });

    return transactions.map((t: any) => {
        const isOverdue = t.status !== "PAGO" && t.data_vencimento < new Date();
        return {
            ...t,
            status: isOverdue ? "ATRASADO" : t.status,
            formattedAmount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(t.valor)),
            displayDate: format(t.data_vencimento, "dd/MM/yyyy", { locale: ptBR })
        };
    });
}

export async function getCategories(userId: string) {
    return db.category.findMany({ where: { userId } });
}

export async function getPaymentMethods(userId: string) {
    return db.paymentMethod.findMany({ where: { userId } });
}
