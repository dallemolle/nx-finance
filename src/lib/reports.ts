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

    // By default, exclude provisions from reports unless explicitly requested
    if (!filters?.includeProvisions) {
        where.is_provisioned = false;
    }

    if (filters?.status && filters.status !== "ALL") where.status = filters.status;
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

    const itemsByHeader = new Map<string, any[]>();
    for (const item of invoiceItems) {
        if (!item.transactionId) continue;
        const list = itemsByHeader.get(item.transactionId) || [];
        list.push({
            ...item,
            valor: Number(item.valor),
            formattedAmount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valor)),
            displayDate: format(item.data_compra, "dd/MM/yyyy", { locale: ptBR }),
        });
        itemsByHeader.set(item.transactionId, list);
    }

    return transactions.map((t: any) => {
        const isOverdue = t.status !== "PAGO" && t.data_vencimento < new Date();
        return {
            ...t,
            valor: Number(t.valor),
            status: isOverdue ? "ATRASADO" : t.status,
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
