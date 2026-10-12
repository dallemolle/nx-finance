import { beforeEach, describe, expect, test } from "vitest";
import bcrypt from "bcryptjs";
import { generate, generateSecret } from "otplib";
import { db } from "@/lib/db";
import {
    countRemainingRecoveryCodesForUser,
    disableTwoFactorForUser,
    enableTwoFactorForUser,
    regenerateRecoveryCodesForUser,
    verifySecondFactor,
} from "./two-factor";
import { createUserWithCard, type Scenario } from "../../../test/fixtures";

const PASSWORD = "senha-certa-123";

// BL-021 (códigos de recuperação) e BL-022 (senha para mexer no 2FA).
describe("2FA com códigos de recuperação", () => {
    let s: Scenario;
    let secret: string;
    const totp = () => generate({ secret });
    const userRow = () => db.user.findUniqueOrThrow({ where: { id: s.user.id } });

    beforeEach(async () => {
        s = await createUserWithCard();
        await db.user.update({ where: { id: s.user.id }, data: { password: await bcrypt.hash(PASSWORD, 4) } });
        secret = generateSecret();
    });

    async function enable() {
        return enableTwoFactorForUser(s.user.id, { secret, code: await totp(), password: PASSWORD });
    }

    describe("ativar", () => {
        test("liga o 2FA e devolve 10 códigos, guardados só como hash", async () => {
            const { recoveryCodes } = await enable();

            expect((await userRow()).status_2fa).toBe(true);
            expect(recoveryCodes).toHaveLength(10);
            const stored = await db.twoFactorRecoveryCode.findMany({ where: { userId: s.user.id } });
            expect(stored).toHaveLength(10);
            const storedText = JSON.stringify(stored);
            for (const code of recoveryCodes) expect(storedText).not.toContain(code.replace("-", ""));
            expect(await countRemainingRecoveryCodesForUser(s.user.id)).toBe(10);
        });

        test("exige a senha (sessão roubada não ativa 2FA com outro celular)", async () => {
            await expect(enableTwoFactorForUser(s.user.id, { secret, code: await totp(), password: "errada" })).rejects.toThrow(/senha/i);

            expect((await userRow()).status_2fa).toBe(false);
        });

        test("exige o código do app certo", async () => {
            await expect(enableTwoFactorForUser(s.user.id, { secret, code: "000000", password: PASSWORD })).rejects.toThrow(/código/i);
        });
    });

    describe("login (verifySecondFactor)", () => {
        test("aceita o código do app", async () => {
            await enable();

            expect(await verifySecondFactor(await userRow(), await totp())).toBe(true);
            expect(await verifySecondFactor(await userRow(), "000000")).toBe(false);
        });

        test("código de recuperação vale uma vez só, digitado de qualquer jeito", async () => {
            const { recoveryCodes } = await enable();
            const code = recoveryCodes[0];

            expect(await verifySecondFactor(await userRow(), ` ${code.toLowerCase().replace("-", "")} `)).toBe(true);
            expect(await verifySecondFactor(await userRow(), code)).toBe(false);
            expect(await countRemainingRecoveryCodesForUser(s.user.id)).toBe(9);
        });

        test("dois logins simultâneos com o mesmo código: só um passa", async () => {
            const { recoveryCodes } = await enable();
            const user = await userRow();

            const results = await Promise.all([verifySecondFactor(user, recoveryCodes[1]), verifySecondFactor(user, recoveryCodes[1])]);

            expect(results.filter(Boolean)).toHaveLength(1);
        });

        test("código de recuperação de outro usuário não serve", async () => {
            const { recoveryCodes } = await enable();
            const other = await createUserWithCard();
            const otherUser = await db.user.update({ where: { id: other.user.id }, data: { status_2fa: true, secret_2fa: generateSecret() } });

            expect(await verifySecondFactor(otherUser, recoveryCodes[0])).toBe(false);
            expect(await countRemainingRecoveryCodesForUser(s.user.id)).toBe(10);
        });
    });

    describe("gerar novos códigos", () => {
        test("invalida os antigos", async () => {
            const { recoveryCodes: old } = await enable();

            const { recoveryCodes: fresh } = await regenerateRecoveryCodesForUser(s.user.id, { password: PASSWORD, code: await totp() });

            expect(fresh).toHaveLength(10);
            expect(await verifySecondFactor(await userRow(), old[0])).toBe(false);
            expect(await verifySecondFactor(await userRow(), fresh[0])).toBe(true);
        });

        test("exige senha", async () => {
            await enable();

            await expect(regenerateRecoveryCodesForUser(s.user.id, { password: "errada", code: await totp() })).rejects.toThrow(/senha/i);
        });
    });

    describe("desativar (BL-022)", () => {
        test("com senha e código do app: desliga e apaga os códigos", async () => {
            await enable();

            await disableTwoFactorForUser(s.user.id, { password: PASSWORD, code: await totp() });

            const user = await userRow();
            expect([user.status_2fa, user.secret_2fa]).toEqual([false, null]);
            expect(await db.twoFactorRecoveryCode.count({ where: { userId: s.user.id } })).toBe(0);
        });

        test("celular perdido: desativa com senha e um código de recuperação", async () => {
            const { recoveryCodes } = await enable();

            await disableTwoFactorForUser(s.user.id, { password: PASSWORD, code: recoveryCodes[3] });

            expect((await userRow()).status_2fa).toBe(false);
        });

        test("só o código não basta: sem a senha certa não desativa", async () => {
            await enable();

            await expect(disableTwoFactorForUser(s.user.id, { password: "errada", code: await totp() })).rejects.toThrow(/senha/i);
            expect((await userRow()).status_2fa).toBe(true);
        });

        test("senha certa com código errado não desativa", async () => {
            await enable();

            await expect(disableTwoFactorForUser(s.user.id, { password: PASSWORD, code: "000000" })).rejects.toThrow(/código/i);
            expect((await userRow()).status_2fa).toBe(true);
        });
    });
});
