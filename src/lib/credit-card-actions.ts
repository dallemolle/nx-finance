"use server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { CreditCardInvoiceInput } from "@/lib/validations";
import { getErrorMessage, getPrismaErrorMessage } from "@/lib/utils";
import {
    findPossibleDuplicateInstallmentsForUser,
    importCreditCardInvoiceForUser,
    type PossibleDuplicateInstallmentCheck,
    type PossibleDuplicateInstallmentMatch,
} from "@/lib/services/credit-card-import";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

// Regra em services/credit-card-import.ts (importCreditCardInvoiceForUser).
export async function importCreditCardInvoice(data: CreditCardInvoiceInput) {
    try {
        const userId = await getUserId();
        const result = await importCreditCardInvoiceForUser(userId, data);

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return {
            success: true,
            data: {
                transaction: {
                    ...result.transaction,
                    valor: Number(result.transaction.valor),
                },
                itemsCount: result.itemsCount,
            },
        };
    } catch (error: unknown) {
        console.error("Error importing credit card invoice:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao importar fatura de cartão de crédito"));
    }
}

// Regra em services/credit-card-import.ts (findPossibleDuplicateInstallmentsForUser).
export async function findPossibleDuplicateInstallments(
    creditCardId: string,
    items: PossibleDuplicateInstallmentCheck[]
): Promise<PossibleDuplicateInstallmentMatch[]> {
    const userId = await getUserId();
    return findPossibleDuplicateInstallmentsForUser(userId, creditCardId, items);
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
    } catch (error: unknown) {
        console.error("Error fetching invoice items:", error);
        throw new Error(getErrorMessage(error, "Erro ao buscar itens da fatura"));
    }
}

export async function getInvoiceHeaders(month: number, year: number) {
    const userId = await getSessionUserId();
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
