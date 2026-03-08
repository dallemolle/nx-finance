"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createTransaction(data: any) {
    const transaction = await db.transaction.create({
        data: {
            descricao: data.descricao,
            valor: parseFloat(data.valor),
            tipo: data.tipo,
            status: data.status || "PENDENTE",
            data_vencimento: new Date(data.data_vencimento),
            userId: data.userId,
            categoria_id: data.categoria_id,
            tipo_pagamento_id: data.tipo_pagamento_id,
        },
    });
    revalidatePath("/");
    revalidatePath("/reports");
    return transaction;
}

export async function updateTransaction(id: string, data: any) {
    const transaction = await db.transaction.update({
        where: { id },
        data: {
            descricao: data.descricao,
            valor: parseFloat(data.valor),
            tipo: data.tipo,
            status: data.status,
            data_vencimento: new Date(data.data_vencimento),
            categoria_id: data.categoria_id,
            tipo_pagamento_id: data.tipo_pagamento_id,
        },
    });
    revalidatePath("/");
    revalidatePath("/reports");
    return transaction;
}

export async function deleteTransaction(id: string) {
    await db.transaction.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/reports");
}

export async function getCategories(userId: string) {
    return db.category.findMany({ where: { userId } });
}

export async function getPaymentMethods(userId: string) {
    return db.paymentMethod.findMany({ where: { userId } });
}

export async function createCategory(data: any) {
    return db.category.create({
        data: {
            nome: data.nome,
            cor: data.cor || "#000000",
            icone: data.icone || "Tag",
            tipo: data.tipo,
            userId: data.userId,
        },
    });
}

export async function createPaymentMethod(data: any) {
    return db.paymentMethod.create({
        data: {
            nome: data.nome,
            userId: data.userId,
        },
    });
}
