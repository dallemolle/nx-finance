"use server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { CreditCardInvoiceInput } from "@/lib/validations";
import { getErrorMessage } from "@/lib/utils";
import { actionResult } from "@/lib/action-result";
import { monthRange } from "@/lib/date-only";
import {
    deleteImportedInvoiceForUser,
    findPossibleDuplicateInstallmentsForUser,
    importCreditCardInvoiceForUser,
    type PossibleDuplicateInstallmentCheck,
    type PossibleDuplicateInstallmentMatch,
} from "@/lib/services/credit-card-import";

// Regra em services/credit-card-import.ts (importCreditCardInvoiceForUser).
// Devolve ActionResult (BL-044): o navegador usa unwrap().
export async function importCreditCardInvoice(data: CreditCardInvoiceInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao importar fatura de cartão de crédito", async () => {
        const result = await importCreditCardInvoiceForUser(userId, data);

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return {
            transaction: {
                ...result.transaction,
                valor: Number(result.transaction.valor),
            },
            itemsCount: result.itemsCount,
        };
    });
}

// Apaga uma fatura importada (real) e os itens dela, pra refazer uma importação
// errada. Regra em services/credit-card-import.ts (deleteImportedInvoiceForUser).
export async function deleteImportedInvoice(transactionId: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao excluir a fatura importada", async () => {
        const result = await deleteImportedInvoiceForUser(userId, transactionId);

        revalidatePath("/");
        revalidatePath("/faturas");
        revalidatePath("/reports");
        return { deletedItems: result.deletedItems };
    });
}

// Regra em services/credit-card-import.ts (findPossibleDuplicateInstallmentsForUser).
export async function findPossibleDuplicateInstallments(
    creditCardId: string,
    items: PossibleDuplicateInstallmentCheck[]
): Promise<PossibleDuplicateInstallmentMatch[]> {
    const userId = await getSessionUserId();
    return findPossibleDuplicateInstallmentsForUser(userId, creditCardId, items);
}

export async function getInvoiceItems(transactionId: string) {
    try {
        const userId = await getSessionUserId();

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
    const invoices = await db.transaction.findMany({
        where: {
            userId,
            is_invoice_header: true,
            data_vencimento: monthRange(year, month),
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
