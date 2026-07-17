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

export async function getProvisionedBudget(monthsAhead: number = 12, includeAllExpenses: boolean = true): Promise<MonthlyCommitment[]> {
    try {
        const userId = await getUserId();
        const now = new Date();

        const startDate = startOfMonth(now);
        const endDate = endOfMonth(addMonths(now, monthsAhead));

        // 1. Fetch provisioned items (future installments)
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

        // 2. Fetch realized installment items (already reconciled/paid)
        const realizedInstallments = await db.creditCardInvoiceItem.findMany({
            where: {
                userId,
                is_provisioned: false,
                is_installment: true,
                data_compra: { gte: startDate, lte: endDate },
            },
        });

        // 3. Fetch regular SAIDA transactions (non-invoice, non-installment)
        const regularExpenses = includeAllExpenses
            ? await db.transaction.findMany({
                where: {
                    userId,
                    tipo: "SAIDA",
                    is_invoice_header: false,
                    data_vencimento: { gte: startDate, lte: endDate },
                },
              })
            : [];

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

        // Aggregate provisioned items
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

        // Aggregate realized installment items
        for (const item of realizedInstallments) {
            const key = `${item.data_compra.getFullYear()}-${item.data_compra.getMonth()}`;
            const entry = monthlyMap.get(key);
            if (entry) {
                const valor = Number(item.valor);
                entry.totalRealized += valor;
                entry.grandTotal += valor;
            }
        }

        // Aggregate regular SAIDA transactions
        for (const t of regularExpenses) {
            const key = `${t.data_vencimento.getFullYear()}-${t.data_vencimento.getMonth()}`;
            const entry = monthlyMap.get(key);
            if (entry) {
                const valor = Number(t.valor);
                entry.totalRealized += valor;
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
