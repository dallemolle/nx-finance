"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    } catch (error: any) {
        console.error("Error fetching mapping suggestions:", error);
        throw new Error("Erro ao buscar mapeamentos");
    }
}

export async function saveMappingSuggestion(searchTerm: string, categoryId: string) {
    try {
        const userId = await getUserId();
        const suggestion = await db.mappingSuggestion.upsert({
            where: {
                search_term_userId: {
                    search_term: searchTerm.toLowerCase().trim(),
                    userId
                }
            },
            update: {
                categoria_id: categoryId
            },
            create: {
                search_term: searchTerm.toLowerCase().trim(),
                categoria_id: categoryId,
                userId
            }
        });
        return suggestion;
    } catch (error: any) {
        console.error("Error saving mapping suggestion:", error);
        throw new Error("Erro ao salvar mapeamento inteligente");
    }
}

export async function processBatchTransactions(transactions: any[]) {
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
                    tipo_pagamento_id: t.tipo_pagamento_id || null,
                    institution_id: t.institution_id
                }
            }))
        );

        // Learn mappings for each transaction
        // Group by search term to avoid redundant writes
        for (const t of transactions) {
            if (t.original_title && t.categoria_id) {
                const searchTerm = t.original_title.toLowerCase().trim();
                await db.mappingSuggestion.upsert({
                    where: {
                        search_term_userId: {
                            search_term: searchTerm,
                            userId
                        }
                    },
                    update: {
                        categoria_id: t.categoria_id
                    },
                    create: {
                        search_term: searchTerm,
                        categoria_id: t.categoria_id,
                        userId
                    }
                });
            }
        }

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        
        return { success: true, count: createdTransactions.length };
    } catch (error: any) {
        console.error("Error processing batch transactions:", error);
        throw new Error(error.message || "Erro ao importar transações em lote");
    }
}
