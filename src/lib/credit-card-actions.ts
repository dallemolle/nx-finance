"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCardInvoiceSchema } from "@/lib/validations";
import { addMonths, getMonth, getYear } from "date-fns";

const VALUE_TOLERANCE = 0.02;

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function generateInstallmentGroup(descricao: string, userId: string): string {
    const slug = slugify(descricao);
    return `${slug}-${userId}`;
}

function valuesMatch(a: number, b: number): boolean {
    return Math.abs(a - b) <= VALUE_TOLERANCE;
}

export async function importCreditCardInvoice(data: any) {
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

        const processedItems: any[] = [];
        const createdProvisions: any[] = [];

        for (const item of validatedData.items) {
            const descricao = item.descricao;
            const valorItem = Math.abs(item.valor);
            const dataCompra = new Date(item.data_compra);
            const itemMonth = getMonth(dataCompra);
            const itemYear = getYear(dataCompra);

            let matchedProvision = false;

            if (validatedData.isReconciliation) {
                const group = item.uniqueInstallmentGroup || generateInstallmentGroup(descricao, userId);

                const candidates = await db.creditCardInvoiceItem.findMany({
                    where: {
                        is_provisioned: true,
                        unique_installment_group: group,
                    },
                });

                const match = candidates.find((p) => {
                    const pDate = p.data_vencimento_original || p.data_compra;
                    return (
                        getMonth(pDate) === itemMonth &&
                        getYear(pDate) === itemYear &&
                        valuesMatch(Number(p.valor), valorItem)
                    );
                });

                if (match) {
                    await db.creditCardInvoiceItem.update({
                        where: { id: match.id },
                        data: {
                            transactionId: transaction.id,
                            is_provisioned: false,
                            descricao,
                            categoria_id: item.categoria_id,
                            data_compra: dataCompra,
                        },
                    });
                    processedItems.push({ ...match, descricao, valor: valorItem, is_provisioned: false });
                    matchedProvision = true;
                }

                if (!match) {
                    const fallbackCandidates = await db.creditCardInvoiceItem.findMany({
                        where: {
                            is_provisioned: true,
                            transactionId: null,
                            data_vencimento_original: {
                                gte: new Date(itemYear, itemMonth, 1),
                                lte: new Date(itemYear, itemMonth + 1, 0, 23, 59, 59, 999),
                            },
                        },
                    });

                    const fallbackMatch = fallbackCandidates.find((p) => {
                        return valuesMatch(Number(p.valor), valorItem) && (
                            group === p.unique_installment_group ||
                            slugify(p.descricao).includes(slugify(descricao)) ||
                            slugify(descricao).includes(slugify(p.descricao))
                        );
                    });

                    if (fallbackMatch) {
                        await db.creditCardInvoiceItem.update({
                            where: { id: fallbackMatch.id },
                            data: {
                                transactionId: transaction.id,
                                is_provisioned: false,
                                unique_installment_group: group,
                                descricao,
                                categoria_id: item.categoria_id,
                                data_compra: dataCompra,
                            },
                        });
                        processedItems.push({ ...fallbackMatch, descricao, valor: valorItem, is_provisioned: false, unique_installment_group: group });
                        matchedProvision = true;
                    }
                }
            }

            if (!matchedProvision) {
                const group = item.uniqueInstallmentGroup || generateInstallmentGroup(descricao, userId);

                const newItem = await db.creditCardInvoiceItem.create({
                    data: {
                        transactionId: transaction.id,
                        descricao,
                        valor: valorItem,
                        categoria_id: item.categoria_id,
                        data_compra: dataCompra,
                        is_installment: item.isInstallment || false,
                        total_installments: item.totalInstallments || null,
                        current_installment: item.currentInstallment || null,
                        is_provisioned: false,
                        unique_installment_group: item.isInstallment ? group : null,
                    },
                });

                processedItems.push(newItem);

                if (item.isInstallment && item.totalInstallments && item.currentInstallment) {
                    const remaining = item.totalInstallments - item.currentInstallment;
                    const provisionsData: any[] = [];

                    for (let i = 1; i <= remaining; i++) {
                        const futureMonthOffset = item.currentInstallment + i;
                        const provisionDate = addMonths(dataCompra, i);

                        provisionsData.push({
                            descricao: `${descricao} (${futureMonthOffset}/${item.totalInstallments})`,
                            valor: valorItem,
                            data_compra: dataCompra,
                            data_vencimento_original: provisionDate,
                            categoria_id: item.categoria_id,
                            is_installment: true,
                            total_installments: item.totalInstallments,
                            current_installment: futureMonthOffset,
                            is_provisioned: true,
                            transactionId: null,
                            unique_installment_group: group,
                        });
                    }

                    if (provisionsData.length > 0) {
                        await db.creditCardInvoiceItem.createMany({ data: provisionsData });
                        createdProvisions.push(...provisionsData);
                    }
                }
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
                itemsCount: processedItems.length,
                provisionsCount: createdProvisions.length,
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

export async function getOutstandingProvisions(userId: string) {
    const provisions = await db.creditCardInvoiceItem.findMany({
        where: {
            is_provisioned: true,
            transactionId: null,
        },
        include: { category: true },
        orderBy: { data_vencimento_original: "asc" },
    });

    return provisions.map(p => ({
        ...p,
        valor: Number(p.valor),
    }));
}
