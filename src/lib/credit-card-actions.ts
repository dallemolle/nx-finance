"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCardInvoiceSchema } from "@/lib/validations";
import { addMonths, startOfMonth, endOfMonth } from "date-fns";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export async function importCreditCardInvoice(data: any, reconciliationMap?: Record<number, string>) {
    try {
        const userId = await getUserId();
        const validatedData = creditCardInvoiceSchema.parse(data);

        const totalValor = validatedData.items.reduce((sum, item) => sum + Math.abs(item.valor), 0);

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

        const createdItems: any[] = [];

        for (const item of validatedData.items) {
            const itemKey = (item as any)._key;
            const reconciledProvisionId = reconciliationMap?.[itemKey];

            if (reconciledProvisionId) {
                // User-confirmed reconciliation: update existing provision
                const reconciled = await db.creditCardInvoiceItem.update({
                    where: { id: reconciledProvisionId },
                    data: {
                        transactionId: transaction.id,
                        descricao: item.descricao,
                        valor: Math.abs(item.valor),
                        categoria_id: item.categoria_id,
                        data_compra: item.data_compra,
                        is_provisioned: false,
                    },
                });
                createdItems.push(reconciled);
                continue;
            }

            if (item.is_installment && item.unique_installment_group && item.current_installment) {
                // New installment purchase — create current + future provisions
                const currentItem = await db.creditCardInvoiceItem.create({
                    data: {
                        transactionId: transaction.id,
                        descricao: item.descricao,
                        valor: Math.abs(item.valor),
                        categoria_id: item.categoria_id,
                        data_compra: item.data_compra,
                        userId,
                        is_installment: true,
                        total_installments: item.total_installments!,
                        current_installment: item.current_installment,
                        is_provisioned: false,
                        unique_installment_group: item.unique_installment_group,
                    },
                });
                createdItems.push(currentItem);

                // CSV value IS the individual installment value (not total)
                const installmentValue = Math.abs(item.valor);
                const remainingCount = item.total_installments! - item.current_installment!;

                const futurePromises = Array.from({ length: remainingCount }, (_, i) => {
                    const installmentIndex = item.current_installment! + 1 + i;
                    const dueDate = addMonths(item.data_compra, installmentIndex - 1);

                    return db.creditCardInvoiceItem.create({
                        data: {
                            transactionId: null,
                            descricao: `${item.descricao} (${String(installmentIndex).padStart(2, "0")}/${String(item.total_installments!).padStart(2, "0")})`,
                            valor: installmentValue,
                            categoria_id: item.categoria_id,
                            data_compra: item.data_compra,
                            data_vencimento_original: dueDate,
                            userId,
                            is_installment: true,
                            total_installments: item.total_installments!,
                            current_installment: installmentIndex,
                            is_provisioned: true,
                            unique_installment_group: item.unique_installment_group,
                        },
                    });
                });

                const provisions = await Promise.all(futurePromises);
                createdItems.push(...provisions);
            } else {
                const normalItem = await db.creditCardInvoiceItem.create({
                    data: {
                        transactionId: transaction.id,
                        descricao: item.descricao,
                        valor: Math.abs(item.valor),
                        categoria_id: item.categoria_id,
                        data_compra: item.data_compra,
                        userId,
                        is_installment: false,
                        is_provisioned: false,
                    },
                });
                createdItems.push(normalItem);
            }
        }

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return {
            success: true,
            data: {
                transaction: {
                    ...transaction,
                    valor: Number(transaction.valor),
                },
                itemsCount: createdItems.length,
                provisionsCount: createdItems.filter((i: any) => i.is_provisioned).length,
            },
        };
    } catch (error: any) {
        console.error("Error importing credit card invoice:", error);
        throw new Error(error.message || "Erro ao importar fatura de cartão de crédito");
    }
}

export interface ReconciliationSuggestion {
    itemIndex: number;
    itemDescription: string;
    itemValue: number;
    provisionId: string;
    provisionDescription: string;
    provisionValue: number;
    provisionDueDate: Date;
    provisionCurrentInstallment: number;
    provisionTotalInstallments: number;
    uniqueInstallmentGroup: string;
}

export async function previewReconciliation(items: any[]): Promise<ReconciliationSuggestion[]> {
    try {
        const userId = await getUserId();
        const suggestions: ReconciliationSuggestion[] = [];

        for (const item of items) {
            if (!item.is_installment || !item.amount || !item.date) continue;

            const itemDate = new Date(item.date);
            const itemValue = Math.abs(item.amount);
            const monthStart = startOfMonth(itemDate);
            const monthEnd = endOfMonth(itemDate);

            const candidates = await db.creditCardInvoiceItem.findMany({
                where: {
                    userId,
                    is_provisioned: true,
                    data_vencimento_original: { gte: monthStart, lte: monthEnd },
                    valor: { gte: itemValue - 0.01, lte: itemValue + 0.01 },
                },
            });

            if (candidates.length === 0) continue;

            const itemWords = item.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
            const bestMatch = candidates.reduce<{ candidate: typeof candidates[0] | null; score: number }>(
                (best, candidate) => {
                    const desc = candidate.descricao.toLowerCase();
                    const groupMatch = candidate.unique_installment_group === item.unique_installment_group ? 100 : 0;
                    const wordMatches = itemWords.filter((w: string) => desc.includes(w)).length;
                    const score = groupMatch + wordMatches;
                    return score > best.score ? { candidate, score } : best;
                },
                { candidate: null, score: -1 }
            );

            if (bestMatch.candidate) {
                const p = bestMatch.candidate;
                suggestions.push({
                    itemIndex: item.id,
                    itemDescription: item.title,
                    itemValue,
                    provisionId: p.id,
                    provisionDescription: p.descricao,
                    provisionValue: Number(p.valor),
                    provisionDueDate: p.data_vencimento_original || p.data_compra,
                    provisionCurrentInstallment: p.current_installment || 0,
                    provisionTotalInstallments: p.total_installments || 0,
                    uniqueInstallmentGroup: p.unique_installment_group || "",
                });
            }
        }

        return suggestions;
    } catch (error: any) {
        console.error("Error previewing reconciliation:", error);
        return [];
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

export async function deleteCreditCardInvoice(transactionId: string) {
    try {
        const userId = await getUserId();

        const transaction = await db.transaction.findUnique({
            where: { id: transactionId, userId },
            select: { id: true, is_invoice_header: true },
        });

        if (!transaction) {
            throw new Error("Transação não encontrada");
        }
        if (!transaction.is_invoice_header) {
            throw new Error("Esta transação não é uma fatura de cartão de crédito");
        }

        // Unlink orphaned provisions before deletion so they survive
        await db.creditCardInvoiceItem.updateMany({
            where: {
                transactionId,
                is_provisioned: false,
                is_installment: true,
            },
            data: { transactionId: null, is_provisioned: true },
        });

        await db.transaction.delete({
            where: { id: transactionId, userId },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting credit card invoice:", error);
        throw new Error(error.message || "Erro ao excluir fatura de cartão de crédito");
    }
}
