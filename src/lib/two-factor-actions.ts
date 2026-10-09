"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { twoFactorCodeSchema, type TwoFactorCodeInput } from "@/lib/validations";
import { getPrismaErrorMessage } from "@/lib/utils";

// Tolerância de 1 time-step (30s) pra frente e pra trás, absorvendo pequeno
// drift de relógio entre o servidor e o app autenticador do usuário.
const EPOCH_TOLERANCE = 30;

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

export async function enableTwoFactor(secret: string, data: TwoFactorCodeInput) {
    try {
        const { userId } = await getSession();
        const { code } = twoFactorCodeSchema.parse(data);

        const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE });
        if (!result.valid) {
            throw new Error("Código de verificação inválido");
        }

        await db.user.update({
            where: { id: userId },
            data: { status_2fa: true, secret_2fa: secret },
        });

        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error enabling 2FA:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao ativar 2FA"));
    }
}

export async function disableTwoFactor(data: TwoFactorCodeInput) {
    try {
        const { userId } = await getSession();
        const { code } = twoFactorCodeSchema.parse(data);

        const user = await db.user.findUnique({ where: { id: userId }, select: { secret_2fa: true } });
        if (!user?.secret_2fa) {
            throw new Error("2FA não está ativado");
        }

        const result = await verify({ secret: user.secret_2fa, token: code, epochTolerance: EPOCH_TOLERANCE });
        if (!result.valid) {
            throw new Error("Código de verificação inválido");
        }

        await db.user.update({
            where: { id: userId },
            data: { status_2fa: false, secret_2fa: null },
        });

        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error disabling 2FA:", error);
        throw new Error(getPrismaErrorMessage(error, "Erro ao desativar 2FA"));
    }
}
