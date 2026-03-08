"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { categorySchema, paymentMethodSchema, transactionSchema } from "@/lib/validations";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

// Transaction Actions
export async function createTransaction(data: any) {
    const userId = await getUserId();
    const validatedData = transactionSchema.parse(data);

    const transaction = await db.transaction.create({
        data: {
            ...validatedData,
            userId,
        },
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return transaction;
}

export async function updateTransaction(id: string, data: any) {
    const userId = await getUserId();
    const validatedData = transactionSchema.parse(data);

    const transaction = await db.transaction.update({
        where: { id, userId },
        data: validatedData,
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return transaction;
}

export async function deleteTransaction(id: string) {
    const userId = await getUserId();
    await db.transaction.delete({
        where: { id, userId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");
}

// Category Actions
export async function createCategory(data: any) {
    const userId = await getUserId();
    const validatedData = categorySchema.parse(data);

    // Check if category already exists for this user and type
    const existing = await db.category.findUnique({
        where: {
            nome_userId_tipo: {
                nome: validatedData.nome,
                userId,
                tipo: validatedData.tipo,
            },
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
}

// Payment Method Actions
export async function createPaymentMethod(data: any) {
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
}
