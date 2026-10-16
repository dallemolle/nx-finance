"use server";

import { ZodError } from "zod";
import { getSessionUserId } from "@/lib/session";
import type { ChangePasswordInput } from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";
import { changePasswordForUser } from "@/lib/services/account";

export type ChangePasswordResult = { success: true } | { success: false; error: string };

// Regras em services/account.ts (BL-042). Erro esperado (senha atual errada,
// validação, bloqueio) volta como valor, não como exceção: em produção o
// React troca a mensagem de um erro lançado por uma genérica ("Minified
// React error #441"), e o usuário não saberia o que corrigir.
export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const userId = await getSessionUserId();
    try {
        await changePasswordForUser(userId, input);
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? "Dados inválidos" };
        console.error("Error changing password:", error);
        return { success: false, error: getPrismaErrorMessage(error, "Erro ao alterar a senha") };
    }
}
