"use server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { toDateOnly } from "./date-only";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { actionResult } from "@/lib/action-result";
import { getMerchantSignature } from "@/lib/dashboard-utils";
import type { TransactionStatus, TransactionType } from "@prisma/client";

export async function getMappingSuggestions() {
    try {
        const userId = await getSessionUserId();
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

// As que alteram dados devolvem ActionResult (BL-044): o navegador usa unwrap().
export async function saveMappingSuggestion(searchTerm: string, categoryId: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao salvar mapeamento inteligente", async () => {
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
    });
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
    const userId = await getSessionUserId();
    return actionResult("Erro ao importar transações em lote", async () => {
        // Save the transactions
        const createdTransactions = await db.$transaction(
            transactions.map(t => db.transaction.create({
                data: {
                    descricao: t.descricao,
                    valor: t.valor,
                    data_vencimento: toDateOnly(t.data_vencimento),
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

        return { count: createdTransactions.length };
    });
}
