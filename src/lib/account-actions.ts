"use server";

import { getSessionUserId } from "@/lib/session";
import type { ChangePasswordInput } from "@/lib/validations";
import { actionResult } from "@/lib/action-result";
import { changePasswordForUser } from "@/lib/services/account";

// Regras em services/account.ts (BL-042). Devolve ActionResult (BL-044).
export async function changePassword(input: ChangePasswordInput) {
    const userId = await getSessionUserId();
    return actionResult("Erro ao alterar a senha", () => changePasswordForUser(userId, input));
}
