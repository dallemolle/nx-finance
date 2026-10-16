"use server";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
    categorySchema,
    newCategorySchema,
    paymentMethodSchema,
    transactionSchema,
    financialInstitutionSchema,
    type TransactionInput,
    type CategoryInput,
    type NewCategoryInput,
    type PaymentMethodInput,
    type FinancialInstitutionInput,
} from "@/lib/validations";
import { addMonthsDateOnly } from "./date-only";
import { Decimal } from "decimal.js";
import { splitInstallments } from "./credit-card-cycle";
import { suggestCategoryColor } from "./category-colors";
import { actionResult } from "./action-result";
import { deleteTransactionForUser, paymentDateForStatus } from "./services/transactions";

// Todas devolvem ActionResult (BL-044): o navegador usa unwrap() pra ter o
// dado ou um erro com a mensagem legível, também no build de produção.

function revalidateTransactions() {
    revalidatePath("/dashboard");
    revalidatePath("/reports");
}

function revalidateSettings() {
    revalidateTransactions();
    revalidatePath("/dashboard/settings");
}

// Transaction Actions
export async function createTransaction(data: TransactionInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao criar transação", async () => {
        const validatedData = transactionSchema.parse(data);
        const { isInstallment, installmentsCount, installmentDescriptions, ...rest } = validatedData;

        if (isInstallment && installmentsCount && installmentsCount > 1) {
            const installments = splitInstallments(new Decimal(rest.valor), installmentsCount);

            const transactions = await db.$transaction(
                installments.map((installment, i) => {
                    const defaultDescription = `${rest.descricao} (${String(i + 1).padStart(2, '0')}/${String(installmentsCount).padStart(2, '0')})`;
                    return db.transaction.create({
                        data: {
                            ...rest,
                            descricao: installmentDescriptions?.[i] || defaultDescription,
                            valor: installment.value.toNumber(),
                            data_vencimento: addMonthsDateOnly(rest.data_vencimento, i),
                            userId,
                        },
                    });
                })
            );

            revalidateTransactions();
            return { ...transactions[0], valor: Number(transactions[0].valor) };
        }

        const transaction = await db.transaction.create({
            data: {
                ...rest,
                userId,
            },
        });

        revalidateTransactions();
        return { ...transaction, valor: Number(transaction.valor) };
    });
}

export async function updateTransaction(id: string, data: TransactionInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao atualizar transação", async () => {
        const validatedData = transactionSchema.parse(data);
        // Parcelamento só existe na criação; na edição esses campos do formulário não são gravados.
        const { isInstallment, installmentsCount, installmentDescriptions, data_pagamento, ...rest } = validatedData;

        const current = await db.transaction.findFirst({ where: { id, userId }, select: { data_pagamento: true } });
        if (!current) throw new Error("Lançamento não encontrado.");

        const transaction = await db.transaction.update({
            where: { id, userId },
            data: { ...rest, data_pagamento: paymentDateForStatus(rest.status, data_pagamento ?? current.data_pagamento) },
        });

        revalidateTransactions();
        return { ...transaction, valor: Number(transaction.valor) };
    });
}

export async function payTransaction(id: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao liquidar transação", async () => {
        // Previsão não se liquida: ou é efetivada (despesa prevista) ou é
        // substituída pela fatura importada (fatura prevista). Pagá-la deixava
        // o lançamento pago e ainda previsto, fora dos totais (BL-009).
        const current = await db.transaction.findFirst({ where: { id, userId }, select: { is_provisioned: true } });
        if (current?.is_provisioned) throw new Error("Lançamento previsto não pode ser liquidado. Efetive a despesa prevista ou importe a fatura real.");

        const transaction = await db.transaction.update({
            where: { id, userId },
            data: { status: "PAGO", data_pagamento: new Date() },
        });

        revalidateTransactions();
        return { ...transaction, valor: Number(transaction.valor) };
    });
}

export async function deleteTransaction(id: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao deletar transação", async () => {
        await deleteTransactionForUser(userId, id);
        revalidateTransactions();
    });
}

// Category Actions
export async function createCategory(data: NewCategoryInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao criar categoria", async () => {
        const validatedData = newCategorySchema.parse(data);

        // Check if category already exists for this user and type (case-insensitive)
        const existing = await db.category.findFirst({
            where: {
                nome: {
                    equals: validatedData.nome,
                    mode: 'insensitive'
                },
                userId,
                tipo: validatedData.tipo,
            },
        });

        if (existing) return existing;

        // Sem cor informada: sorteia uma que não repete nem lembra as do usuário.
        const cor = validatedData.cor ?? suggestCategoryColor(
            (await db.category.findMany({ where: { userId }, select: { cor: true } })).map(c => c.cor),
        );

        const category = await db.category.create({
            data: {
                ...validatedData,
                cor,
                userId,
            },
        });

        revalidateSettings();
        return category;
    });
}

export async function updateCategory(id: string, data: Partial<CategoryInput>) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao atualizar categoria", async () => {
        const validatedData = categorySchema.partial().parse(data);

        const category = await db.category.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidateSettings();
        return category;
    });
}

export async function deleteCategory(id: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao excluir categoria", async () => {
        const transactionCount = await db.transaction.count({
            where: { userId, categoria_id: id },
        });

        if (transactionCount > 0) {
            throw new Error(`Não é possível excluir. Existem ${transactionCount} transações vinculadas a esta categoria.`);
        }

        await db.category.delete({
            where: { id, userId },
        });

        revalidateSettings();
    });
}

// Payment Method Actions
export async function createPaymentMethod(data: PaymentMethodInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao criar meio de pagamento", async () => {
        const validatedData = paymentMethodSchema.parse(data);

        // Check if payment method already exists for this user
        const existing = await db.paymentMethod.findUnique({
            where: {
                nome_userId: {
                    nome: validatedData.nome,
                    userId,
                },
            },
        });

        if (existing) return existing;

        const paymentMethod = await db.paymentMethod.create({
            data: {
                ...validatedData,
                userId,
            },
        });

        revalidateSettings();
        return paymentMethod;
    });
}

export async function updatePaymentMethod(id: string, data: Partial<PaymentMethodInput>) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao atualizar meio de pagamento", async () => {
        const validatedData = paymentMethodSchema.partial().parse(data);

        const paymentMethod = await db.paymentMethod.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidateSettings();
        return paymentMethod;
    });
}

export async function deletePaymentMethod(id: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao excluir meio de pagamento", async () => {
        const transactionCount = await db.transaction.count({
            where: { userId, tipo_pagamento_id: id },
        });

        if (transactionCount > 0) {
            throw new Error(`Não é possível excluir. Existem ${transactionCount} transações vinculadas a este meio de pagamento.`);
        }

        await db.paymentMethod.delete({
            where: { id, userId },
        });

        revalidateSettings();
    });
}

// Financial Institution Actions
export async function createFinancialInstitution(data: FinancialInstitutionInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao criar instituição financeira", async () => {
        const validatedData = financialInstitutionSchema.parse(data);

        // Check if institution already exists for this user
        const existing = await db.financialInstitution.findUnique({
            where: {
                nome_userId: {
                    nome: validatedData.nome,
                    userId,
                },
            },
        });

        if (existing) return existing;

        const financialInstitution = await db.financialInstitution.create({
            data: {
                ...validatedData,
                userId,
            },
        });

        revalidateSettings();
        return financialInstitution;
    });
}

export async function updateFinancialInstitution(id: string, data: Partial<FinancialInstitutionInput>) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao atualizar instituição financeira", async () => {
        const validatedData = financialInstitutionSchema.partial().parse(data);

        const financialInstitution = await db.financialInstitution.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidateSettings();
        return financialInstitution;
    });
}

export async function deleteFinancialInstitution(id: string) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao excluir instituição financeira", async () => {
        // Validation: verify if the institution has linked transactions
        const transactionCount = await db.transaction.count({
            where: {
                userId,
                institution_id: id,
            }
        });

        if (transactionCount > 0) {
            throw new Error(`Não é possível excluir. Existem ${transactionCount} transações vinculadas a esta instituição.`);
        }

        await db.financialInstitution.delete({
            where: {
                id,
                userId,
            },
        });

        revalidateSettings();
    });
}
