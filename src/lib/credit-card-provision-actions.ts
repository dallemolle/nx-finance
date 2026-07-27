"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Decimal } from "decimal.js";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    creditCardSchema,
    cardInstallmentPurchaseSchema,
    estimatedExpenseSchema,
    confirmEstimatedExpenseSchema,
    type CreditCardInput,
    type CardInstallmentPurchaseInput,
    type EstimatedExpenseInput,
    type ConfirmEstimatedExpenseInput,
} from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";
import {
    getInvoiceReferenceMonth,
    addInvoiceMonths,
    computeInvoiceDueDate,
    splitInstallments,
} from "@/lib/credit-card-cycle";
import {
    getOrCreateInvoiceCategory,
    getOrCreateProvisionedPaymentMethod,
    findProvisionedHeader,
} from "@/lib/credit-card-shared";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

// --- CRUD CreditCard ---

export async function getCreditCards(userId: string) {
    const cards = await db.creditCard.findMany({
        where: { userId },
        include: { institution: true },
        orderBy: { nome: "asc" },
    });
    return cards.map(c => ({ ...c, limite: c.limite ? Number(c.limite) : null }));
}

export async function createCreditCard(data: CreditCardInput) {
    try {
        const userId = await getUserId();
        const validatedData = creditCardSchema.parse(data);
        const card = await db.creditCard.create({ data: { ...validatedData, userId } });
        revalidatePath("/dashboard/settings");
        return { success: true, data: { ...card, limite: card.limite ? Number(card.limite) : null } };
    } catch (error: unknown) {
        console.error("Error creating credit card:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao criar cartão"));
    }
}

export async function updateCreditCard(id: string, data: Partial<CreditCardInput>) {
    try {
        const userId = await getUserId();
        const validatedData = creditCardSchema.partial().parse(data);
        const card = await db.creditCard.update({
            where: { id, userId },
            data: validatedData,
        });
        revalidatePath("/dashboard/settings");
        return { success: true, data: { ...card, limite: card.limite ? Number(card.limite) : null } };
    } catch (error: unknown) {
        console.error("Error updating credit card:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao atualizar cartão"));
    }
}

export async function deleteCreditCard(id: string) {
    try {
        const userId = await getUserId();
        const linkedCount = await db.transaction.count({ where: { credit_card_id: id, userId } });
        if (linkedCount > 0) {
            throw new Error("Não é possível excluir um cartão com faturas ou compras vinculadas.");
        }
        await db.creditCard.delete({ where: { id, userId } });
        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error deleting credit card:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao excluir cartão"));
    }
}

// --- Provisionamento ---

export async function findOrCreateProvisionedHeader(
    tx: Tx,
    args: {
        userId: string;
        card: { id: string; nome: string; closingDay: number; dueDay: number; institution_id: string };
        invoiceMonth: number;
        invoiceYear: number;
        categoryId: string;
        paymentMethodId: string;
    }
) {
    const existing = await tx.transaction.findFirst({
        where: {
            userId: args.userId,
            credit_card_id: args.card.id,
            is_invoice_header: true,
            is_provisioned: true,
            invoice_month: args.invoiceMonth,
            invoice_year: args.invoiceYear,
        },
    });
    if (existing) return existing;

    const dueDate = computeInvoiceDueDate(args.invoiceMonth, args.invoiceYear, args.card.closingDay, args.card.dueDay);
    return tx.transaction.create({
        data: {
            descricao: `Fatura Prevista - ${args.card.nome} - ${String(args.invoiceMonth).padStart(2, "0")}/${args.invoiceYear}`,
            valor: 0,
            data_vencimento: dueDate,
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            is_provisioned: true,
            userId: args.userId,
            credit_card_id: args.card.id,
            invoice_month: args.invoiceMonth,
            invoice_year: args.invoiceYear,
            categoria_id: args.categoryId,
            tipo_pagamento_id: args.paymentMethodId,
            institution_id: args.card.institution_id,
        },
    });
}

export async function provisionCardInstallmentPurchase(data: CardInstallmentPurchaseInput) {
    try {
        const userId = await getUserId();
        const validatedData = cardInstallmentPurchaseSchema.parse(data);

        const card = await db.creditCard.findFirst({ where: { id: validatedData.credit_card_id, userId } });
        if (!card) throw new Error("Cartão não encontrado.");

        const totalValue = new Decimal(validatedData.valor);
        const installments = splitInstallments(totalValue, validatedData.installmentsCount);
        const reference = getInvoiceReferenceMonth(validatedData.data_compra, card.closingDay);
        const installmentGroupId = crypto.randomUUID();

        await db.$transaction(async (tx) => {
            const category = await getOrCreateInvoiceCategory(tx, userId);
            const paymentMethod = await getOrCreateProvisionedPaymentMethod(tx, userId);

            // Cada parcela cai num mês distinto (addInvoiceMonths com offsets únicos), então
            // as N cadeias find-or-create/create/update podem rodar em paralelo com segurança
            // (sem risco de duas parcelas disputarem o mesmo cabeçalho) — evita estourar o
            // timeout padrão da transação interativa do Prisma em parcelamentos longos.
            await Promise.all(installments.map(async (installment, i) => {
                const { month, year } = addInvoiceMonths(reference.month, reference.year, i);
                const header = await findOrCreateProvisionedHeader(tx, {
                    userId,
                    card,
                    invoiceMonth: month,
                    invoiceYear: year,
                    categoryId: category.id,
                    paymentMethodId: paymentMethod.id,
                });

                const value = installment.value;
                await tx.creditCardInvoiceItem.create({
                    data: {
                        transactionId: header.id,
                        descricao: `${validatedData.descricao} (${String(i + 1).padStart(2, "0")}/${String(installments.length).padStart(2, "0")})`,
                        valor: value.toNumber(),
                        data_compra: validatedData.data_compra,
                        categoria_id: validatedData.categoria_id,
                        is_provisioned: true,
                        installment_group_id: installmentGroupId,
                        installment_number: i + 1,
                        installment_total: installments.length,
                    },
                });
                await tx.transaction.update({
                    where: { id: header.id },
                    data: { valor: { increment: value.toNumber() } },
                });
            }));
        }, { timeout: 20000 });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error provisioning card installment purchase:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao provisionar compra parcelada"));
    }
}

export async function provisionEstimatedExpense(data: EstimatedExpenseInput) {
    try {
        const userId = await getUserId();
        const validatedData = estimatedExpenseSchema.parse(data);

        await db.$transaction(async (tx) => {
            const category = await getOrCreateInvoiceCategory(tx, userId);

            const isInstallment = validatedData.isInstallment && !!validatedData.installmentsCount && validatedData.installmentsCount > 1;

            if (validatedData.credit_card_id) {
                const card = await tx.creditCard.findFirst({ where: { id: validatedData.credit_card_id, userId } });
                if (!card) throw new Error("Cartão não encontrado.");
                const paymentMethod = await getOrCreateProvisionedPaymentMethod(tx, userId);

                if (isInstallment) {
                    // Estimativa parcelada: divide o valor (mesma matemática de
                    // provisionCardInstallmentPurchase), partindo direto do mês
                    // escolhido pelo usuário — sem cálculo de closingDay, já que
                    // aqui não existe uma data de compra real.
                    const installments = splitInstallments(new Decimal(validatedData.valor), validatedData.installmentsCount!);
                    const groupId = crypto.randomUUID();
                    // Meses distintos por parcela -> seguro paralelizar (ver provisionCardInstallmentPurchase)
                    await Promise.all(installments.map(async (installment, i) => {
                        const { month, year } = addInvoiceMonths(validatedData.invoice_month, validatedData.invoice_year, i);
                        const header = await findOrCreateProvisionedHeader(tx, {
                            userId, card, invoiceMonth: month, invoiceYear: year,
                            categoryId: category.id, paymentMethodId: paymentMethod.id,
                        });
                        const value = installment.value;
                        await tx.creditCardInvoiceItem.create({
                            data: {
                                transactionId: header.id,
                                descricao: `${validatedData.descricao} (${String(i + 1).padStart(2, "0")}/${String(installments.length).padStart(2, "0")})`,
                                valor: value.toNumber(),
                                data_compra: new Date(validatedData.invoice_year, validatedData.invoice_month - 1, 1),
                                categoria_id: validatedData.categoria_id,
                                is_provisioned: true,
                                installment_group_id: groupId,
                                installment_number: i + 1,
                                installment_total: installments.length,
                            },
                        });
                        await tx.transaction.update({ where: { id: header.id }, data: { valor: { increment: value.toNumber() } } });
                    }));
                } else {
                    const header = await findOrCreateProvisionedHeader(tx, {
                        userId,
                        card,
                        invoiceMonth: validatedData.invoice_month,
                        invoiceYear: validatedData.invoice_year,
                        categoryId: category.id,
                        paymentMethodId: paymentMethod.id,
                    });

                    await tx.creditCardInvoiceItem.create({
                        data: {
                            transactionId: header.id,
                            descricao: validatedData.descricao,
                            valor: validatedData.valor,
                            data_compra: new Date(validatedData.invoice_year, validatedData.invoice_month - 1, 1),
                            categoria_id: validatedData.categoria_id,
                            is_provisioned: true,
                            installment_group_id: null,
                        },
                    });
                    await tx.transaction.update({
                        where: { id: header.id },
                        data: { valor: { increment: validatedData.valor } },
                    });
                }
            } else {
                if (!validatedData.tipo_pagamento_id || !validatedData.institution_id) {
                    throw new Error("Informe um cartão ou um meio de pagamento + instituição.");
                }
                // Extraídos em const pra manter o narrowing acima dentro do closure do Promise.all abaixo
                // (TS não propaga o narrowing de `validatedData.campo` pra dentro de funções aninhadas).
                const tipoPagamentoId = validatedData.tipo_pagamento_id;
                const institutionId = validatedData.institution_id;
                const startDate = new Date(validatedData.invoice_year, validatedData.invoice_month - 1, 1);

                if (isInstallment) {
                    // Mesma lógica de parcelamento genérico já usada em createTransaction
                    // (src/lib/actions.ts) — sem installment_group_id, já que Transaction
                    // não tem essa coluna e o parcelamento genérico de hoje também não usa.
                    const totalValue = new Decimal(validatedData.valor);
                    const count = validatedData.installmentsCount!;
                    const installmentValue = totalValue.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
                    const lastInstallmentValue = totalValue.minus(installmentValue.times(count - 1));

                    await Promise.all(Array.from({ length: count }, (_, i) => {
                        const value = i === count - 1 ? lastInstallmentValue : installmentValue;
                        return tx.transaction.create({
                            data: {
                                descricao: `${validatedData.descricao} (${String(i + 1).padStart(2, "0")}/${String(count).padStart(2, "0")})`,
                                valor: value.toNumber(),
                                data_vencimento: addMonths(startDate, i),
                                status: "PENDENTE",
                                tipo: "SAIDA",
                                is_provisioned: true,
                                userId,
                                categoria_id: validatedData.categoria_id,
                                tipo_pagamento_id: tipoPagamentoId,
                                institution_id: institutionId,
                            },
                        });
                    }));
                } else {
                    await tx.transaction.create({
                        data: {
                            descricao: validatedData.descricao,
                            valor: validatedData.valor,
                            data_vencimento: startDate,
                            status: "PENDENTE",
                            tipo: "SAIDA",
                            is_provisioned: true,
                            userId,
                            categoria_id: validatedData.categoria_id,
                            tipo_pagamento_id: validatedData.tipo_pagamento_id,
                            institution_id: validatedData.institution_id,
                        },
                    });
                }
            }
        }, { timeout: 20000 });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error provisioning estimated expense:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao provisionar despesa prevista"));
    }
}

// Cancela/exclui um item avulso de fatura projetada (parcela futura ou
// estimativa no cartão). Recalcula o valor do header ou o remove, se ficar
// vazio — mesma limpeza usada em reconcileProvisionedInstallments.
export async function deleteProvisionedInvoiceItem(itemId: string) {
    try {
        const userId = await getUserId();

        const item = await db.creditCardInvoiceItem.findFirst({
            where: { id: itemId, is_provisioned: true, transaction: { userId } },
        });
        if (!item) throw new Error("Item previsto não encontrado.");

        const headerId = item.transactionId;
        await db.creditCardInvoiceItem.delete({ where: { id: itemId } });

        const remaining = await db.creditCardInvoiceItem.count({ where: { transactionId: headerId } });
        if (remaining === 0) {
            await db.transaction.delete({ where: { id: headerId } });
        } else {
            const sum = await db.creditCardInvoiceItem.aggregate({
                where: { transactionId: headerId },
                _sum: { valor: true },
            });
            await db.transaction.update({ where: { id: headerId }, data: { valor: sum._sum.valor ?? 0 } });
        }

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error deleting provisioned invoice item:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao excluir item previsto"));
    }
}

// "Efetiva" uma despesa prevista GENÉRICA (sem cartão): confirma o valor real
// (pode divergir do estimado, ex: conta de luz) e tira a marca de "previsto".
// Guarda no servidor (não só na UI): só aceita is_provisioned:true e
// credit_card_id:null — a versão vinculada a cartão fica de fora de propósito,
// pra não mexer com fatura parcialmente confirmada/parcialmente projetada.
export async function confirmEstimatedExpense(id: string, data: ConfirmEstimatedExpenseInput) {
    try {
        const userId = await getUserId();
        const validatedData = confirmEstimatedExpenseSchema.parse(data);

        const existing = await db.transaction.findFirst({
            where: { id, userId, is_provisioned: true, credit_card_id: null },
        });
        if (!existing) throw new Error("Despesa prevista não encontrada (ou não é genérica).");

        const updated = await db.transaction.update({
            where: { id },
            data: {
                valor: validatedData.valor,
                descricao: validatedData.descricao ?? existing.descricao,
                categoria_id: validatedData.categoria_id ?? existing.categoria_id,
                data_vencimento: validatedData.data_vencimento ?? existing.data_vencimento,
                is_provisioned: false,
            },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true, data: { ...updated, valor: Number(updated.valor) } };
    } catch (error: unknown) {
        console.error("Error confirming estimated expense:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao efetivar despesa prevista"));
    }
}

// Chamada de dentro de importCreditCardInvoice (credit-card-actions.ts) quando
// a fatura real importada informa um credit_card_id. Só concilia parcelas
// (installment_group_id preenchido) — geradas pelo próprio sistema, então o
// casamento é exato. Estimativas avulsas (installment_group_id null) não são
// tocadas: ficam pendentes até o usuário limpar manualmente.
export async function reconcileProvisionedInstallments(
    tx: Tx,
    args: { userId: string; creditCardId: string; invoiceMonth: number; invoiceYear: number; newHeaderId: string }
): Promise<{ carriedCount: number; carriedTotal: number }> {
    const provisioned = await findProvisionedHeader(tx, {
        userId: args.userId,
        creditCardId: args.creditCardId,
        invoiceMonth: args.invoiceMonth,
        invoiceYear: args.invoiceYear,
    });
    if (!provisioned) return { carriedCount: 0, carriedTotal: 0 };

    const toCarry = provisioned.invoiceItems.filter(i => i.installment_group_id !== null);
    if (toCarry.length === 0) return { carriedCount: 0, carriedTotal: 0 };

    const carriedTotal = toCarry.reduce((sum, i) => sum + Number(i.valor), 0);

    await tx.creditCardInvoiceItem.updateMany({
        where: { id: { in: toCarry.map(i => i.id) } },
        data: { transactionId: args.newHeaderId, is_provisioned: false },
    });
    await tx.transaction.update({
        where: { id: args.newHeaderId },
        data: { valor: { increment: carriedTotal } },
    });

    const remaining = await tx.creditCardInvoiceItem.count({ where: { transactionId: provisioned.id } });
    if (remaining === 0) {
        await tx.transaction.delete({ where: { id: provisioned.id } });
    } else {
        const sum = await tx.creditCardInvoiceItem.aggregate({
            where: { transactionId: provisioned.id },
            _sum: { valor: true },
        });
        await tx.transaction.update({
            where: { id: provisioned.id },
            data: { valor: sum._sum.valor ?? 0 },
        });
    }

    return { carriedCount: toCarry.length, carriedTotal };
}

// --- Timeline de faturas / comprometimento mensal ---

const TIMELINE_MONTHS_DEFAULT = 6;

export async function getInvoiceTimeline(userId: string, monthsAhead: number = TIMELINE_MONTHS_DEFAULT) {
    const now = new Date();
    const rangeStart = startOfMonth(now);
    const rangeEnd = endOfMonth(addMonths(now, monthsAhead - 1));

    const [headers, cards] = await Promise.all([
        db.transaction.findMany({
            where: {
                userId,
                is_invoice_header: true,
                data_vencimento: { gte: rangeStart, lte: rangeEnd },
                credit_card_id: { not: null },
            },
            include: { invoiceItems: true },
        }),
        db.creditCard.findMany({ where: { userId } }),
    ]);

    const cardById = new Map(cards.map(c => [c.id, c]));

    const buckets = Array.from({ length: monthsAhead }, (_, i) => {
        const bucketDate = addMonths(now, i);
        return {
            key: `${bucketDate.getFullYear()}-${bucketDate.getMonth() + 1}`,
            label: format(bucketDate, "MMM/yy", { locale: ptBR }),
            confirmed: 0,
            provisioned: 0,
            byCard: new Map<string, { nome: string; confirmed: number; provisioned: number }>(),
        };
    });
    const bucketByKey = new Map(buckets.map(b => [b.key, b]));

    for (const header of headers) {
        if (header.invoice_month == null || header.invoice_year == null || !header.credit_card_id) continue;
        const key = `${header.invoice_year}-${header.invoice_month}`;
        const bucket = bucketByKey.get(key);
        if (!bucket) continue;

        const card = cardById.get(header.credit_card_id);
        if (!bucket.byCard.has(header.credit_card_id)) {
            bucket.byCard.set(header.credit_card_id, { nome: card?.nome ?? "Cartão", confirmed: 0, provisioned: 0 });
        }
        const cardBucket = bucket.byCard.get(header.credit_card_id)!;

        for (const item of header.invoiceItems) {
            const value = Number(item.valor);
            if (item.is_provisioned) {
                bucket.provisioned += value;
                cardBucket.provisioned += value;
            } else {
                bucket.confirmed += value;
                cardBucket.confirmed += value;
            }
        }
    }

    return buckets.map(b => ({
        label: b.label,
        confirmed: b.confirmed,
        provisioned: b.provisioned,
        total: b.confirmed + b.provisioned,
        byCard: Array.from(b.byCard.values()),
    }));
}
