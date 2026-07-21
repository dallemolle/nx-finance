"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCardInvoiceSchema } from "@/lib/validations";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export async function importCreditCardInvoice(data: any) {
    try {
        const userId = await getUserId();
        const validatedData = creditCardInvoiceSchema.parse(data);

        const totalValor = validatedData.items.reduce((sum, item) => sum + Math.abs(item.valor), 0);

        // Find or create a generic "Fatura Cartão" category for the invoice header
        // This category exists only to satisfy the FK — it is excluded from chart aggregation
        const invoiceCategory = await db.category.findFirst({
            where: { userId, nome: "Fatura Cartão", tipo: "SAIDA" },
        }) || await db.category.create({
            data: {
                nome: "Fatura Cartão",
                cor: "#6366f1",
                icone: "CreditCard",
                tipo: "SAIDA",
                userId,
            },
        });

        // Create the invoice header transaction
        const transaction = await db.transaction.create({
            data: {
                descricao: validatedData.descricao,
                valor: totalValor,
                data_vencimento: validatedData.data_vencimento,
                status: "PENDENTE",
                tipo: "SAIDA",
                is_invoice_header: true,
                userId,
                categoria_id: invoiceCategory.id,
                tipo_pagamento_id: validatedData.tipo_pagamento_id,
                institution_id: validatedData.institution_id,
            },
        });

        // Bulk create invoice items in a single query
        const { count: itemsCount } = await db.creditCardInvoiceItem.createMany({
            data: validatedData.items.map(item => ({
                transactionId: transaction.id,
                descricao: item.descricao,
                valor: Math.abs(item.valor),
                categoria_id: item.categoria_id,
                data_compra: item.data_compra,
            })),
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return {
            success: true,
            data: {
                transaction: {
                    ...transaction,
                    valor: Number(transaction.valor),
                },
                itemsCount,
            },
        };
    } catch (error: any) {
        console.error("Error importing credit card invoice:", error);
        throw new Error(error.message || "Erro ao importar fatura de cartão de crédito");
    }
}

export async function getInvoiceItems(transactionId: string) {
    try {
        const userId = await getUserId();

        const items = await db.creditCardInvoiceItem.findMany({
            where: {
                transactionId,
                transaction: { userId },
            },
            include: { category: true },
            orderBy: { data_compra: "asc" },
        });

        return items.map(item => ({
            ...item,
            valor: Number(item.valor),
        }));
    } catch (error: any) {
        console.error("Error fetching invoice items:", error);
        throw new Error("Erro ao buscar itens da fatura");
    }
}

export async function getInvoiceHeaders(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const invoices = await db.transaction.findMany({
        where: {
            userId,
            is_invoice_header: true,
            data_vencimento: { gte: startDate, lte: endDate },
        },
        include: {
            invoiceItems: {
                include: { category: true },
            },
            institution: true,
        },
        orderBy: { data_vencimento: "desc" },
    });

    return invoices.map(inv => ({
        ...inv,
        valor: Number(inv.valor),
        invoiceItems: inv.invoiceItems.map(item => ({
            ...item,
            valor: Number(item.valor),
        })),
    }));
}
