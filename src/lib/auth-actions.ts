"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";

export async function registerUser(data: RegisterInput) {
    const validatedData = registerSchema.parse(data);

    const existingUser = await db.user.findUnique({
        where: { email: validatedData.email },
    });

    if (existingUser) {
        throw new Error("E-mail já cadastrado");
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    try {
        const user = await db.user.create({
            data: {
                email: validatedData.email,
                password: hashedPassword,
            },
        });

        // Seed default categories for new user
        await db.category.createMany({
            data: [
                { nome: "Salário", cor: "#10b981", icone: "Wallet", tipo: "ENTRADA", userId: user.id },
                { nome: "Alimentação", cor: "#f43f5e", icone: "Utensils", tipo: "SAIDA", userId: user.id },
                { nome: "Transporte", cor: "#3b82f6", icone: "Car", tipo: "SAIDA", userId: user.id },
                { nome: "Lazer", cor: "#f59e0b", icone: "Gamepad2", tipo: "SAIDA", userId: user.id },
            ],
        });

        return { success: true };
    } catch (error: unknown) {
        console.error("Error registering user:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao cadastrar usuário"));
    }
}
