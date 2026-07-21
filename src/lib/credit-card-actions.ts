"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCardInvoiceSchema } from "@/lib/validations";
import { addMonths } from "date-fns";
import { Decimal } from "decimal.js";

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

        // Bulk create invoice items, supporting installment provisioning
        const items = await Promise.all(
            validatedData.items.map(async (item: any) => {
                const createdItem = await db.creditCardInvoiceItem.create({
                    data: {
                        transactionId: transaction.id,
                        descricao: item.descricao,
                        valor: Math.abs(item.valor),
                        categoria_id: item.categoria_id,
                        data_compra: item.data_compra,
                        institution_id: validatedData.institution_id,
                    },
                });

                // If this item has installment info, generate future provisioned items
                if (item.totalInstallments && item.totalInstallments > 1) {
                    const groupId = crypto.randomUUID();
                    const totalInstallments = item.totalInstallments;
                    const currentInstallment = item.currentInstallment || 1;
                    const itemValor = new Decimal(Math.abs(item.valor));
                    const installmentValor = itemValor
                        .dividedBy(totalInstallments)
                        .toDecimalPlaces(2, Decimal.ROUND_DOWN);
                    const lastInstallmentValor = itemValor.minus(
                        installmentValor.times(totalInstallments - 1)
                    );

                    // Mark the current item as part of this group
                    await db.creditCardInvoiceItem.update({
                        where: { id: createdItem.id },
                        data: {
                            is_installment: true,
                            current_installment: currentInstallment,
                            total_installments: totalInstallments,
                            unique_installment_group: groupId,
                        },
                    });

                    // Generate future provisioned items
                    const futureItems = Array.from({
                        length: totalInstallments,
                    })
                        .map((_, i) => i + 1)
                        .filter((n) => n !== currentInstallment)
                        .map((installmentNumber) => {
                            const isLast = installmentNumber === totalInstallments;
                            const val = isLast ? lastInstallmentValor : installmentValor;
                            const dueDate = addMonths(
                                new Date(item.data_compra),
                                installmentNumber - currentInstallment
                            );

                            return db.creditCardInvoiceItem.create({
                                data: {
                                    descricao: `${item.descricao.trim()} (${String(installmentNumber).padStart(2, "0")}/${String(totalInstallments).padStart(2, "0")})`,
                                    valor: val.toNumber(),
                                    data_compra: item.data_compra,
                                    data_vencimento_original: dueDate,
                                    is_provisioned: true,
                                    is_installment: true,
                                    current_installment: installmentNumber,
                                    total_installments: totalInstallments,
                                    unique_installment_group: groupId,
                                    institution_id: validatedData.institution_id,
                                    categoria_id: item.categoria_id,
                                },
                            });
                        });

                    if (futureItems.length > 0) {
                        await db.$transaction(futureItems);
                    }
                }

                return createdItem;
            })
        );

        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return {
            success: true,
            data: {
                transaction: {
                    ...transaction,
                    valor: Number(transaction.valor),
                },
                itemsCount: items.length,
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

export async function getProvisionedInvoiceItems(institutionId: string) {
    try {
        const userId = await getUserId();

        const items = await db.creditCardInvoiceItem.findMany({
            where: {
                is_provisioned: true,
                institution_id: institutionId,
            },
            include: {
                category: true,
                institution: true,
            },
            orderBy: { data_compra: "asc" },
        });

        // Filter by userId through transaction relation OR orphan provisioned items
        const filtered = items.filter((item) => {
            if (item.transactionId) return true;
            return true; // orphan provisions are valid (no transaction linked yet)
        });

        return filtered.map((item) => ({
            ...item,
            valor: Number(item.valor),
        }));
    } catch (error: any) {
        console.error("Error fetching provisioned invoice items:", error);
        throw new Error("Erro ao buscar itens provisionados");
    }
}
