"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { actionResult } from "@/lib/action-result";
import { isRegistrationOpen, PASSWORD_HASH_ROUNDS } from "@/lib/services/account";

// Devolve ActionResult (BL-044): o navegador usa unwrap().
export async function registerUser(data: RegisterInput) {
    return actionResult("Erro ao cadastrar usuário", async () => {
        // Fechado por padrão (BL-043): a tela some, mas a action continua sendo um
        // endpoint público, então a trava vale aqui também.
        if (!isRegistrationOpen()) throw new Error("O cadastro de novos usuários está fechado.");
        const validatedData = registerSchema.parse(data);

        const existingUser = await db.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            throw new Error("E-mail já cadastrado");
        }

        const hashedPassword = await bcrypt.hash(validatedData.password, PASSWORD_HASH_ROUNDS);

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
    });
}
