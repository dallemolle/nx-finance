"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { categorySchema, paymentMethodSchema, transactionSchema, financialInstitutionSchema } from "@/lib/validations";
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
        const { isInstallment, installmentsCount, installmentDescriptions, ...rest } = validatedData;

        if (isInstallment && installmentsCount && installmentsCount > 1) {
            const totalValue = new Decimal(rest.valor);
            const installmentValue = totalValue.dividedBy(installmentsCount).toDecimalPlaces(2, Decimal.ROUND_DOWN);
            const lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1));

            const transactions = await db.$transaction(
                Array.from({ length: installmentsCount }).map((_, i) => {
                    const dueDate = addMonths(new Date(rest.data_vencimento), i);
                    const defaultDescription = `${rest.descricao} (${String(i + 1).padStart(2, '0')}/${String(installmentsCount).padStart(2, '0')})`;
                    const description = (validatedData.installmentDescriptions && validatedData.installmentDescriptions[i]) 
                        ? validatedData.installmentDescriptions[i] 
                        : defaultDescription;
                    
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

export async function payTransaction(id: string) {
    try {
        const userId = await getUserId();
        
        const transaction = await db.transaction.update({
            where: { id, userId },
            data: { status: "PAGO" },
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
        console.error("Error paying transaction:", error);
        throw new Error(error.message || "Erro ao liquidar transação");
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

export async function updateCategory(id: string, data: any) {
    try {
        const userId = await getUserId();
        const validatedData = categorySchema.partial().parse(data);

        const category = await db.category.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return category;
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("Já existe um registro com este nome para este usuário.");
        }
        console.error("Error updating category:", error);
        throw new Error(error.message || "Erro ao atualizar categoria");
    }
}

export async function deleteCategory(id: string) {
    try {
        const userId = await getUserId();
        
        const transactionCount = await db.transaction.count({
            where: { userId, categoria_id: id },
        });

        if (transactionCount > 0) {
            throw new Error(`Não é possível excluir. Existem ${transactionCount} transações vinculadas a esta categoria.`);
        }

        await db.category.delete({
            where: { id, userId },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting category:", error);
        throw new Error(error.message || "Erro ao excluir categoria");
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

export async function updatePaymentMethod(id: string, data: any) {
    try {
        const userId = await getUserId();
        const validatedData = paymentMethodSchema.partial().parse(data);

        const paymentMethod = await db.paymentMethod.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return paymentMethod;
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("Já existe um registro com este nome.");
        }
        console.error("Error updating payment method:", error);
        throw new Error(error.message || "Erro ao atualizar meio de pagamento");
    }
}

export async function deletePaymentMethod(id: string) {
    try {
        const userId = await getUserId();
        
        const transactionCount = await db.transaction.count({
            where: { userId, tipo_pagamento_id: id },
        });

        if (transactionCount > 0) {
            throw new Error(`Não é possível excluir. Existem ${transactionCount} transações vinculadas a este meio de pagamento.`);
        }

        await db.paymentMethod.delete({
            where: { id, userId },
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting payment method:", error);
        throw new Error(error.message || "Erro ao excluir meio de pagamento");
    }
}

// Financial Institution Actions
export async function createFinancialInstitution(data: any) {
    try {
        const userId = await getUserId();
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

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return financialInstitution;
    } catch (error: any) {
        console.error("Error creating financial institution:", error);
        throw new Error(error.message || "Erro ao criar instituição financeira");
    }
}

export async function updateFinancialInstitution(id: string, data: any) {
    try {
        const userId = await getUserId();
        const validatedData = financialInstitutionSchema.partial().parse(data);

        const financialInstitution = await db.financialInstitution.update({
            where: { id, userId },
            data: validatedData,
        });

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return financialInstitution;
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("Já existe uma instituição com este nome.");
        }
        console.error("Error updating financial institution:", error);
        throw new Error(error.message || "Erro ao atualizar instituição financeira");
    }
}

export async function deleteFinancialInstitution(id: string) {
    try {
        const userId = await getUserId();
        
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

        revalidatePath("/dashboard");
        revalidatePath("/reports");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting financial institution:", error);
        throw new Error(error.message || "Erro ao excluir instituição financeira");
    }
}
