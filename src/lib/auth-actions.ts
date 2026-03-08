"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function registerUser(data: any) {
    const { email, password } = data;

    const existingUser = await db.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error("Usuário já existe.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
        data: {
            email,
            password: hashedPassword,
        },
    });

    // Seed default categories
    await db.category.createMany({
        data: [
            { nome: "Alimentação", cor: "#10b981", icone: "Utensils", tipo: "SAIDA", userId: user.id },
            { nome: "Moradia", cor: "#3b82f6", icone: "Home", tipo: "SAIDA", userId: user.id },
            { nome: "Salário", cor: "#8b5cf6", icone: "DollarSign", tipo: "ENTRADA", userId: user.id },
        ],
    });

    return user;
}
