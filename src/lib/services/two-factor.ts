// Regras do 2FA recebendo o userId explicitamente. NÃO é "use server": os
// Server Actions em two-factor-actions.ts resolvem o usuário pela sessão e
// delegam pra cá; o login (auth.ts) usa verifySecondFactor.
import bcrypt from "bcryptjs";
import { verify } from "otplib";
import { db } from "@/lib/db";
import {
    enableTwoFactorSchema,
    twoFactorConfirmSchema,
    type EnableTwoFactorInput,
    type TwoFactorConfirmInput,
} from "@/lib/validations";
import { generateRecoveryCodes, hashRecoveryCode, isTotpCode } from "@/lib/two-factor-codes";
import type { Prisma } from "@prisma/client";

// Tolerância de 1 time-step (30s) pra frente e pra trás, absorvendo pequeno
// drift de relógio entre o servidor e o app autenticador do usuário.
const EPOCH_TOLERANCE = 30;

const INVALID_CODE = "Código de verificação inválido";

async function isValidTotp(secret: string, code: string): Promise<boolean> {
    return (await verify({ secret, token: code.trim(), epochTolerance: EPOCH_TOLERANCE })).valid;
}

// Marca o código como usado numa única operação (só se ainda não foi usado),
// então dois logins simultâneos com o mesmo código não passam os dois.
async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const { count } = await db.twoFactorRecoveryCode.updateMany({
        where: { userId, codeHash: hashRecoveryCode(code), usedAt: null },
        data: { usedAt: new Date() },
    });
    return count === 1;
}

// Segundo fator no login: código de 6 dígitos do app ou um código de recuperação.
export async function verifySecondFactor(user: { id: string; secret_2fa: string | null }, code: string): Promise<boolean> {
    if (isTotpCode(code)) return !!user.secret_2fa && isValidTotp(user.secret_2fa, code);
    return consumeRecoveryCode(user.id, code);
}

async function requirePassword(userId: string, password: string) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(password, user.password))) throw new Error("Senha incorreta");
    return user;
}

async function replaceRecoveryCodes(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({ data: codes.map(code => ({ userId, codeHash: hashRecoveryCode(code) })) });
    return codes;
}

// Devolve os códigos em texto uma única vez, pra tela mostrar; no banco fica só o hash.
export async function enableTwoFactorForUser(userId: string, input: EnableTwoFactorInput): Promise<{ recoveryCodes: string[] }> {
    const { secret, code, password } = enableTwoFactorSchema.parse(input);
    const user = await requirePassword(userId, password);
    if (user.status_2fa) throw new Error("2FA já está ativado");
    if (!(await isValidTotp(secret, code))) throw new Error(INVALID_CODE);

    const recoveryCodes = await db.$transaction(async tx => {
        await tx.user.update({ where: { id: userId }, data: { status_2fa: true, secret_2fa: secret } });
        return replaceRecoveryCodes(tx, userId);
    });
    return { recoveryCodes };
}

async function requirePasswordAndSecondFactor(userId: string, input: TwoFactorConfirmInput) {
    const { code, password } = twoFactorConfirmSchema.parse(input);
    const user = await requirePassword(userId, password);
    if (!user.status_2fa) throw new Error("2FA não está ativado");
    if (!(await verifySecondFactor(user, code))) throw new Error(INVALID_CODE);
}

export async function regenerateRecoveryCodesForUser(userId: string, input: TwoFactorConfirmInput): Promise<{ recoveryCodes: string[] }> {
    await requirePasswordAndSecondFactor(userId, input);
    const recoveryCodes = await db.$transaction(tx => replaceRecoveryCodes(tx, userId));
    return { recoveryCodes };
}

// BL-022: exige a senha além do código. O código pode ser de recuperação, pra
// quem perdeu o celular conseguir desativar e reativar com o aparelho novo.
export async function disableTwoFactorForUser(userId: string, input: TwoFactorConfirmInput): Promise<void> {
    await requirePasswordAndSecondFactor(userId, input);
    await db.$transaction([
        db.user.update({ where: { id: userId }, data: { status_2fa: false, secret_2fa: null } }),
        db.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    ]);
}

export async function countRemainingRecoveryCodesForUser(userId: string): Promise<number> {
    return db.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
}
