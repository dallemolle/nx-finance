"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import type { EnableTwoFactorInput, TwoFactorConfirmInput } from "@/lib/validations";
import { actionResult } from "@/lib/action-result";
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

// Todas devolvem ActionResult (BL-044): o navegador usa unwrap() — senão, em
// produção, "Senha incorreta" e "Código de verificação inválido" chegavam
// como um erro genérico do React.
export async function generateTwoFactorSetup() {
    const { email } = await getSession();
    return actionResult("Erro ao gerar configuração de 2FA", async () => {
        const secret = generateSecret();
        const otpauthUrl = generateURI({ issuer: "NxFinance", label: email, secret });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

        return { secret, qrCodeDataUrl };
    });
}

// Regras em services/two-factor.ts. Ativar devolve os códigos de recuperação
// (mostrados uma vez só na tela).
export async function enableTwoFactor(input: EnableTwoFactorInput) {
    const { userId } = await getSession();
    return actionResult("Erro ao ativar 2FA", async () => {
        const { recoveryCodes } = await enableTwoFactorForUser(userId, input);

        revalidatePath("/dashboard/settings");
        return { recoveryCodes };
    });
}

export async function regenerateRecoveryCodes(input: TwoFactorConfirmInput) {
    const { userId } = await getSession();
    return actionResult("Erro ao gerar novos códigos de recuperação", async () => {
        const { recoveryCodes } = await regenerateRecoveryCodesForUser(userId, input);

        revalidatePath("/dashboard/settings");
        return { recoveryCodes };
    });
}

export async function disableTwoFactor(input: TwoFactorConfirmInput) {
    const { userId } = await getSession();
    return actionResult("Erro ao desativar 2FA", async () => {
        await disableTwoFactorForUser(userId, input);

        revalidatePath("/dashboard/settings");
    });
}
