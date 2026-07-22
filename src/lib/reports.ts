"use server";

import { db } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma, TransactionStatus } from "@prisma/client";

export interface ReportFilters {
    status?: string;
    categoria_id?: string;
    institution_id?: string;
}

export async function getReportData(userId: string, month: number, year: number, filters?: ReportFilters) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const where: Prisma.TransactionWhereInput = {
        userId,
        data_vencimento: {
            gte: startDate,
            lte: endDate,
        },
    };

    if (filters?.status && filters.status !== "ALL") where.status = filters.status as TransactionStatus;
    if (filters?.categoria_id && filters.categoria_id !== "ALL") where.categoria_id = filters.categoria_id;
    if (filters?.institution_id && filters.institution_id !== "ALL") where.institution_id = filters.institution_id;

    const transactions = await db.transaction.findMany({
        where,
        include: {
            category: true,
            paymentMethod: true,
            institution: true,
        },
        orderBy: {
            data_vencimento: "desc",
        },
    });

    // Busca invoice items para transações is_invoice_header
    const invoiceHeaderIds = transactions
        .filter(t => t.is_invoice_header)
        .map(t => t.id);

    const invoiceItems = invoiceHeaderIds.length > 0
        ? await db.creditCardInvoiceItem.findMany({
            where: { transactionId: { in: invoiceHeaderIds } },
            include: { category: true },
          })
        : [];

    const itemsByHeader = new Map<string, (Omit<typeof invoiceItems[number], "valor"> & { valor: number; formattedAmount: string; displayDate: string })[]>();
    for (const item of invoiceItems) {
        const list = itemsByHeader.get(item.transactionId) || [];
        list.push({
            ...item,
            valor: Number(item.valor),
            formattedAmount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valor)),
            displayDate: format(item.data_compra, "dd/MM/yyyy", { locale: ptBR }),
        });
        itemsByHeader.set(item.transactionId, list);
    }

    return transactions.map(t => {
        const isOverdue = t.status !== "PAGO" && t.data_vencimento < new Date();
        return {
            ...t,
            valor: Number(t.valor),
            status: isOverdue ? "ATRASADO" as const : t.status,
            formattedAmount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(t.valor)),
            displayDate: format(t.data_vencimento, "dd/MM/yyyy", { locale: ptBR }),
            invoiceItems: itemsByHeader.get(t.id) || [],
        };
    });
}

export async function getCategories(userId: string) {
    return db.category.findMany({ where: { userId } });
}

export async function getPaymentMethods(userId: string) {
    return db.paymentMethod.findMany({ where: { userId } });
}

export async function getFinancialInstitutions(userId: string) {
    return db.financialInstitution.findMany({ where: { userId } });
}

// Chamada diretamente do client (command-palette.tsx), então autentica pela
// sessão em vez de receber userId como parâmetro confiável.
export async function searchTransactions(query: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");

    const trimmed = query.trim();
    if (!trimmed) return [];

    const transactions = await db.transaction.findMany({
        where: {
            userId: session.user.id,
            descricao: { contains: trimmed, mode: "insensitive" },
        },
        select: { id: true, descricao: true, valor: true, tipo: true, data_vencimento: true },
        orderBy: { data_vencimento: "desc" },
        take: 8,
    });

    return transactions.map(t => ({ ...t, valor: Number(t.valor) }));
}
