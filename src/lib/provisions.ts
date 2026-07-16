"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    startOfMonth,
    endOfMonth,
    addMonths,
    format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export interface MonthlyCommitment {
    month: number;
    year: number;
    label: string;
    totalProvisioned: number;
    totalRealized: number;
    grandTotal: number;
}

export async function getProvisionedBudget(monthsAhead: number = 12): Promise<MonthlyCommitment[]> {
    try {
        const userId = await getUserId();
        const now = new Date();

        const startDate = startOfMonth(now);
        const endDate = endOfMonth(addMonths(now, monthsAhead));

        const provisionedItems = await db.creditCardInvoiceItem.findMany({
            where: {
                userId,
                is_provisioned: true,
                data_vencimento_original: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: { category: true },
        });

        const monthlyMap = new Map<string, MonthlyCommitment>();

        for (let i = 0; i <= monthsAhead; i++) {
            const date = addMonths(now, i);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            monthlyMap.set(key, {
                month: date.getMonth() + 1,
                year: date.getFullYear(),
                label: format(date, "MMM/yyyy", { locale: ptBR }),
                totalProvisioned: 0,
                totalRealized: 0,
                grandTotal: 0,
            });
        }

        for (const item of provisionedItems) {
            const dueDate = item.data_vencimento_original || item.data_compra;
            const key = `${dueDate.getFullYear()}-${dueDate.getMonth()}`;
            const entry = monthlyMap.get(key);
            if (entry) {
                const valor = Number(item.valor);
                entry.totalProvisioned += valor;
                entry.grandTotal += valor;
            }
        }

        return Array.from(monthlyMap.values());
    } catch (error: any) {
        console.error("Error fetching provisioned budget:", error);
        throw new Error("Erro ao buscar orçamento provisionado");
    }
}

export async function getProvisionSummary() {
    try {
        const userId = await getUserId();

        const totalProvisioned = await db.creditCardInvoiceItem.aggregate({
            where: {
                userId,
                is_provisioned: true,
            },
            _sum: { valor: true },
        });

        const totalRealized = await db.creditCardInvoiceItem.aggregate({
            where: {
                userId,
                is_provisioned: false,
                is_installment: true,
            },
            _sum: { valor: true },
        });

        const provisionedCount = await db.creditCardInvoiceItem.count({
            where: { userId, is_provisioned: true },
        });

        return {
            totalProvisioned: Number(totalProvisioned._sum.valor || 0),
            totalRealizedInstallments: Number(totalRealized._sum.valor || 0),
            provisionedCount,
        };
    } catch (error: any) {
        console.error("Error fetching provision summary:", error);
        throw new Error("Erro ao buscar sumário de provisões");
    }
}
