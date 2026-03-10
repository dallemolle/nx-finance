"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { categorySchema, paymentMethodSchema, transactionSchema } from "@/lib/validations";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Decimal } from "decimal.js";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

// Transaction Actions
export async function createTransaction(data: any) {
    try {
        const userId = await getUserId();
        const validatedData = transactionSchema.parse(data);
        const { isInstallment, installmentsCount, ...rest } = validatedData;

        if (isInstallment && installmentsCount && installmentsCount > 1) {
            const totalValue = new Decimal(rest.valor);
            const installmentValue = totalValue.dividedBy(installmentsCount).toDecimalPlaces(2, Decimal.ROUND_DOWN);
            const lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1));

            const transactions = await db.$transaction(
                Array.from({ length: installmentsCount }).map((_, i) => {
                    const dueDate = addMonths(new Date(rest.data_vencimento), i);
                    const description = `${rest.descricao} (${String(i + 1).padStart(2, '0')}/${String(installmentsCount).padStart(2, '0')})`;
                    const currentInstallmentValue = i === installmentsCount - 1 ? lastInstallmentValue : installmentValue;

                    return db.transaction.create({
                        data: {
                            ...rest,
                            descricao: description,
                            valor: currentInstallmentValue.toNumber(),
                            data_vencimento: dueDate,
                            userId,
                        },
                    });
                })
            );

            revalidatePath("/dashboard");
            revalidatePath("/reports");
            return {
                success: true,
                data: {
                    ...transactions[0],
                    valor: Number(transactions[0].valor)
                }
            };
        }

        const transaction = await db.transaction.create({
            data: {
                ...rest,
                userId,
            },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return {
            success: true,
            data: {
                ...transaction,
                valor: Number(transaction.valor)
            }
        };
    } catch (error: any) {
        console.error("Error creating transaction:", error);
        throw new Error(error.message || "Erro ao criar transação");
    }
}

export async function updateTransaction(id: string, data: any) {
    try {
        const userId = await getUserId();
        const validatedData = transactionSchema.parse(data);
        const { isInstallment, installmentsCount, ...rest } = validatedData;

        const transaction = await db.transaction.update({
            where: { id, userId },
            data: rest,
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return {
            success: true,
            data: {
                ...transaction,
                valor: Number(transaction.valor)
            }
        };
    } catch (error: any) {
        console.error("Error updating transaction:", error);
        throw new Error(error.message || "Erro ao atualizar transação");
    }
}

export async function deleteTransaction(id: string) {
    try {
        const userId = await getUserId();
        await db.transaction.delete({
            where: { id, userId },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting transaction:", error);
        throw new Error(error.message || "Erro ao deletar transação");
    }
}

// Category Actions
export async function createCategory(data: any) {
    try {
        const userId = await getUserId();
        const validatedData = categorySchema.parse(data);

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

        const category = await db.category.create({
            data: {
                ...validatedData,
                userId,
            },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return category;
    } catch (error: any) {
        console.error("Error creating category:", error);
        throw new Error(error.message || "Erro ao criar categoria");
    }
}

// Payment Method Actions
export async function createPaymentMethod(data: any) {
    try {
        const userId = await getUserId();
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

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return paymentMethod;
    } catch (error: any) {
        console.error("Error creating payment method:", error);
        throw new Error(error.message || "Erro ao criar meio de pagamento");
    }
}
