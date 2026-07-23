"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getErrorMessage, getPrismaErrorMessage } from "@/lib/utils";
import { getMerchantSignature } from "@/lib/dashboard-utils";
import type { TransactionStatus, TransactionType } from "@prisma/client";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export async function getMappingSuggestions() {
    try {
        const userId = await getUserId();
        const suggestions = await db.mappingSuggestion.findMany({
            where: { userId },
            include: { category: true }
        });
        return suggestions;
    } catch (error: unknown) {
        console.error("Error fetching mapping suggestions:", error);
        throw new Error(getErrorMessage(error, "Erro ao buscar mapeamentos"));
    }
}

export async function saveMappingSuggestion(searchTerm: string, categoryId: string) {
    try {
        const userId = await getUserId();
        const signature = getMerchantSignature(searchTerm);
        const suggestion = await db.mappingSuggestion.upsert({
            where: {
                search_term_userId: {
                    search_term: signature,
                    userId
                }
            },
            update: {
                categoria_id: categoryId
            },
            create: {
                search_term: signature,
                categoria_id: categoryId,
                userId
            }
        });
        return suggestion;
    } catch (error: unknown) {
        console.error("Error saving mapping suggestion:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao salvar mapeamento inteligente"));
    }
}

export interface BatchTransactionInput {
    descricao: string;
    valor: number;
    data_vencimento: string;
    status?: TransactionStatus;
    tipo?: TransactionType;
    categoria_id: string;
    tipo_pagamento_id: string | null;
    institution_id: string;
    original_title?: string;
}

export async function processBatchTransactions(transactions: BatchTransactionInput[]) {
    try {
        const userId = await getUserId();

        // Save the transactions
        const createdTransactions = await db.$transaction(
            transactions.map(t => db.transaction.create({
                data: {
                    descricao: t.descricao,
                    valor: t.valor,
                    data_vencimento: new Date(t.data_vencimento),
                    status: t.status || "PENDENTE",
                    tipo: t.tipo || "SAIDA",
                    userId,
                    categoria_id: t.categoria_id,
                    tipo_pagamento_id: (t.tipo_pagamento_id || null) as string,
                    institution_id: t.institution_id
                }
            }))
        );

        // Learn mappings for each transaction
        // Group by search term to avoid redundant writes
        for (const t of transactions) {
            if (t.original_title && t.categoria_id) {
                const signature = getMerchantSignature(t.original_title);
                if (!signature) continue;
                await db.mappingSuggestion.upsert({
                    where: {
                        search_term_userId: {
                            search_term: signature,
                            userId
                        }
                    },
                    update: {
                        categoria_id: t.categoria_id
                    },
                    create: {
                        search_term: signature,
                        categoria_id: t.categoria_id,
                        userId
                    }
                });
            }
        }

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return { success: true, count: createdTransactions.length };
    } catch (error: unknown) {
        console.error("Error processing batch transactions:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao importar transações em lote"));
    }
}
