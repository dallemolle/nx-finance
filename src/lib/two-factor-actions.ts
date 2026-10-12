"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import type { EnableTwoFactorInput, TwoFactorConfirmInput } from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";
import {
    disableTwoFactorForUser,
    enableTwoFactorForUser,
    regenerateRecoveryCodesForUser,
} from "@/lib/services/two-factor";

// Precisa do e-mail (rótulo no app autenticador), além do userId.
async function getSession() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) throw new Error("Não autorizado");
    return { userId: session.user.id, email: session.user.email };
}

export async function generateTwoFactorSetup() {
    try {
        const { email } = await getSession();

        const secret = generateSecret();
        const otpauthUrl = generateURI({ issuer: "NxFinance", label: email, secret });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

        return { secret, qrCodeDataUrl };
    } catch (error: unknown) {
        console.error("Error generating 2FA setup:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao gerar configuração de 2FA"));
    }
}

// Regras em services/two-factor.ts. Ativar devolve os códigos de recuperação
// (mostrados uma vez só na tela).
export async function enableTwoFactor(input: EnableTwoFactorInput) {
    try {
        const { userId } = await getSession();
        const { recoveryCodes } = await enableTwoFactorForUser(userId, input);

        revalidatePath("/dashboard/settings");
        return { success: true, recoveryCodes };
    } catch (error: unknown) {
        console.error("Error enabling 2FA:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao ativar 2FA"));
    }
}

export async function regenerateRecoveryCodes(input: TwoFactorConfirmInput) {
    try {
        const { userId } = await getSession();
        const { recoveryCodes } = await regenerateRecoveryCodesForUser(userId, input);

        revalidatePath("/dashboard/settings");
        return { success: true, recoveryCodes };
    } catch (error: unknown) {
        console.error("Error regenerating recovery codes:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao gerar novos códigos de recuperação"));
    }
}

export async function disableTwoFactor(input: TwoFactorConfirmInput) {
    try {
        const { userId } = await getSession();
        await disableTwoFactorForUser(userId, input);

        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error disabling 2FA:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao desativar 2FA"));
    }
}
