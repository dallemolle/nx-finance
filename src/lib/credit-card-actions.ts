"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditCardInvoiceSchema, type CreditCardInvoiceInput } from "@/lib/validations";
import { getErrorMessage, getPrismaErrorMessage } from "@/lib/utils";
import { getMerchantSignature } from "@/lib/dashboard-utils";
import { getOrCreateInvoiceCategory, getOrCreateProvisionedPaymentMethod } from "@/lib/credit-card-shared";
import { getReferenceMonthFromDueDate, addInvoiceMonths } from "@/lib/credit-card-cycle";
import { reconcileProvisionedInstallments, findOrCreateProvisionedHeader } from "@/lib/credit-card-provision-actions";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export async function importCreditCardInvoice(data: CreditCardInvoiceInput) {
    try {
        const userId = await getUserId();
        const validatedData = creditCardInvoiceSchema.parse(data);

        // Itens negativos (estorno/reembolso) reduzem o total da fatura
        const totalValor = validatedData.items.reduce((sum, item) => sum + item.valor, 0);
        if (totalValor <= 0) {
            throw new Error("O valor total da fatura deve ser maior que zero. Confira se os estornos não superam as despesas.");
        }

        const result = await db.$transaction(async (tx) => {
            // Find or create a generic "Fatura Cartão" category for the invoice header
            // This category exists only to satisfy the FK — it is excluded from chart aggregation
            const invoiceCategory = await getOrCreateInvoiceCategory(tx, userId);

            let creditCard = null;
            if (validatedData.credit_card_id) {
                creditCard = await tx.creditCard.findFirst({ where: { id: validatedData.credit_card_id, userId } });
            }

            // Create the invoice header transaction
            const transaction = await tx.transaction.create({
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
                    credit_card_id: creditCard?.id ?? null,
                },
            });

            // Criação individual (não createMany) porque itens marcados como parcelados
            // precisam do id gerado pra serem "carimbados" com installment_group_id logo abaixo.
            // Promise.all mantém a ordem de resolução igual à do array de entrada (createdItems[idx]
            // continua correspondendo a validatedData.items[idx]) e dispara as N queries em paralelo
            // em vez de round-trip sequencial — essencial pra não estourar o timeout da transação
            // interativa do Prisma (5s por padrão) em bancos remotos com faturas de muitos itens.
            const createdItems = await Promise.all(
                validatedData.items.map(item =>
                    tx.creditCardInvoiceItem.create({
                        data: {
                            transactionId: transaction.id,
                            descricao: item.descricao,
                            valor: item.valor,
                            categoria_id: item.categoria_id,
                            data_compra: item.data_compra,
                        },
                    })
                )
            );
            const itemsCount = createdItems.length;

            // Aprende a categorização de cada item para sugerir automaticamente
            // em importações futuras do mesmo estabelecimento (também em paralelo)
            await Promise.all(
                validatedData.items.map(item => {
                    const signature = getMerchantSignature(item.descricao);
                    if (!signature) return null;
                    return tx.mappingSuggestion.upsert({
                        where: {
                            search_term_userId: {
                                search_term: signature,
                                userId,
                            },
                        },
                        update: { categoria_id: item.categoria_id },
                        create: { search_term: signature, categoria_id: item.categoria_id, userId },
                    });
                })
            );

            // Se a fatura importada está vinculada a um cartão, concilia parcelas
            // já provisionadas pra esse cartão/mês (migra pra essa fatura real)
            if (creditCard) {
                const { month, year } = getReferenceMonthFromDueDate(
                    validatedData.data_vencimento,
                    creditCard.closingDay,
                    creditCard.dueDay
                );
                await tx.transaction.update({
                    where: { id: transaction.id },
                    data: { invoice_month: month, invoice_year: year },
                });
                await reconcileProvisionedInstallments(tx, {
                    userId,
                    creditCardId: creditCard.id,
                    invoiceMonth: month,
                    invoiceYear: year,
                    newHeaderId: transaction.id,
                });

                // Itens marcados como "compra parcelada" na revisão: o item importado
                // JÁ é uma parcela real, então só projetamos as parcelas restantes nos
                // meses seguintes, com o mesmo valor (extrato de banco já mostra o valor
                // fixo da parcela, não um total a dividir).
                const category = await getOrCreateInvoiceCategory(tx, userId);
                const paymentMethod = await getOrCreateProvisionedPaymentMethod(tx, userId);

                for (let idx = 0; idx < validatedData.items.length; idx++) {
                    const item = validatedData.items[idx];
                    if (!item.isInstallment || !item.installmentsCount) continue;

                    const startNum = item.installmentNumber ?? 1;
                    const total = item.installmentsCount;
                    const groupId = crypto.randomUUID();

                    await tx.creditCardInvoiceItem.update({
                        where: { id: createdItems[idx].id },
                        data: { installment_group_id: groupId, installment_number: startNum, installment_total: total },
                    });

                    for (let num = startNum + 1; num <= total; num++) {
                        const offset = num - startNum;
                        const { month: fm, year: fy } = addInvoiceMonths(month, year, offset);
                        const futureHeader = await findOrCreateProvisionedHeader(tx, {
                            userId, card: creditCard, invoiceMonth: fm, invoiceYear: fy,
                            categoryId: category.id, paymentMethodId: paymentMethod.id,
                        });
                        await tx.creditCardInvoiceItem.create({
                            data: {
                                transactionId: futureHeader.id,
                                descricao: `${item.descricao} (${String(num).padStart(2, "0")}/${String(total).padStart(2, "0")})`,
                                valor: item.valor,
                                data_compra: item.data_compra,
                                categoria_id: item.categoria_id,
                                is_provisioned: true,
                                installment_group_id: groupId,
                                installment_number: num,
                                installment_total: total,
                            },
                        });
                        await tx.transaction.update({ where: { id: futureHeader.id }, data: { valor: { increment: item.valor } } });
                    }
                }
            }

            return { transaction, itemsCount };
        }, { timeout: 20000 }); // margem maior que o padrão de 5s: faturas com muitos itens
        // e/ou geração de parcelas futuras fazem várias queries sequenciais nessa transação.

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
