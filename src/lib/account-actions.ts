"use server";

import { ZodError } from "zod";
import { getSessionUserId } from "@/lib/session";
import type { ChangePasswordInput } from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";
import { changePasswordForUser } from "@/lib/services/account";

// Regras em services/account.ts (BL-042).
export async function changePassword(input: ChangePasswordInput) {
    try {
        const userId = await getSessionUserId();
        await changePasswordForUser(userId, input);
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof ZodError) throw new Error(error.issues[0]?.message ?? "Dados inválidos");
        console.error("Error changing password:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao alterar a senha"));
    }
}
