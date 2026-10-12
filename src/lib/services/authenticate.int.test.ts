import { beforeEach, describe, expect, test } from "vitest";
import bcrypt from "bcryptjs";
import { generate, generateSecret } from "otplib";
import { db } from "@/lib/db";
import { authenticateCredentials, LOGIN_LIMITS } from "./authenticate";
import { createUserWithCard, type Scenario } from "../../../test/fixtures";

const PASSWORD = "senha-certa-123";
const IP = "203.0.113.7";
const T0 = new Date("2026-10-12T12:00:00Z");
const minutesLater = (m: number) => new Date(T0.getTime() + m * 60_000);

// BL-036: limite de tentativas de login (força bruta de senha e do código 2FA).
describe("authenticateCredentials", () => {
    let s: Scenario;
    let email: string;
    const attempt = (password: string, opts: { code?: string; ip?: string; at?: Date; email?: string } = {}) =>
        authenticateCredentials({ email: opts.email ?? email, password, code: opts.code }, opts.ip ?? IP, opts.at ?? T0);
    const failTimes = async (n: number, opts: { ip?: string; at?: Date; email?: string } = {}) => {
        for (let i = 0; i < n; i++) await expect(attempt("errada", opts)).rejects.toThrow("Credenciais inválidas");
    };

    beforeEach(async () => {
        s = await createUserWithCard();
        email = s.user.email;
        await db.user.update({ where: { id: s.user.id }, data: { password: await bcrypt.hash(PASSWORD, 4) } });
    });

    test("senha certa entra; senha errada não", async () => {
        expect(await attempt(PASSWORD)).toEqual({ id: s.user.id, email });
        await expect(attempt("errada")).rejects.toThrow("Credenciais inválidas");
    });

    test(`depois de ${LOGIN_LIMITS.maxPerEmail} erros, bloqueia o e-mail — até com a senha certa`, async () => {
        await failTimes(LOGIN_LIMITS.maxPerEmail);

        await expect(attempt(PASSWORD)).rejects.toThrow(/Muitas tentativas.*15 minutos/);
    });

    test("o bloqueio acaba quando a janela de 15 minutos passa", async () => {
        await failTimes(LOGIN_LIMITS.maxPerEmail);

        await expect(attempt(PASSWORD, { at: minutesLater(14) })).rejects.toThrow(/Muitas tentativas.*1 minuto/);
        expect(await attempt(PASSWORD, { at: minutesLater(15) })).toEqual({ id: s.user.id, email });
    });

    test("login certo zera os erros daquele e-mail", async () => {
        await failTimes(LOGIN_LIMITS.maxPerEmail - 1);
        await attempt(PASSWORD);

        await failTimes(LOGIN_LIMITS.maxPerEmail - 1);
        expect(await attempt(PASSWORD)).toEqual({ id: s.user.id, email });
    });

    test("e-mail com maiúsculas/espaços conta no mesmo limite", async () => {
        await failTimes(LOGIN_LIMITS.maxPerEmail, { email: ` ${email.toUpperCase()} ` });

        await expect(attempt(PASSWORD)).rejects.toThrow(/Muitas tentativas/);
    });

    test("e-mail que não existe também é limitado, com a mesma mensagem (não revela quem tem conta)", async () => {
        const ghost = "ninguem@example.com";
        await failTimes(LOGIN_LIMITS.maxPerEmail, { email: ghost });

        await expect(attempt("qualquer", { email: ghost })).rejects.toThrow(/Muitas tentativas/);
    });

    test(`limite por IP: ${LOGIN_LIMITS.maxPerIp} erros com e-mails variados bloqueiam aquele IP, não os outros`, async () => {
        for (let i = 0; i < LOGIN_LIMITS.maxPerIp; i++) {
            await expect(attempt("errada", { email: `alvo${i}@example.com` })).rejects.toThrow("Credenciais inválidas");
        }

        await expect(attempt(PASSWORD)).rejects.toThrow(/Muitas tentativas/);
        expect(await attempt(PASSWORD, { ip: "198.51.100.9" })).toEqual({ id: s.user.id, email });
    });

    describe("com 2FA", () => {
        let secret: string;
        beforeEach(async () => {
            secret = generateSecret();
            await db.user.update({ where: { id: s.user.id }, data: { status_2fa: true, secret_2fa: secret } });
        });

        test("pedir o código não conta como erro", async () => {
            for (let i = 0; i < LOGIN_LIMITS.maxPerEmail + 2; i++) {
                await expect(attempt(PASSWORD)).rejects.toThrow("2FA_REQUIRED");
            }
            expect(await attempt(PASSWORD, { code: await generate({ secret }) })).toEqual({ id: s.user.id, email });
        });

        test("código errado conta: não dá pra testar os 6 dígitos sem limite", async () => {
            for (let i = 0; i < LOGIN_LIMITS.maxPerEmail; i++) {
                await expect(attempt(PASSWORD, { code: String(100000 + i) })).rejects.toThrow("Código de verificação inválido");
            }

            await expect(attempt(PASSWORD, { code: await generate({ secret }) })).rejects.toThrow(/Muitas tentativas/);
        });
    });

    test("sem IP (ambiente sem o cabeçalho) ainda limita pelo e-mail", async () => {
        for (let i = 0; i < LOGIN_LIMITS.maxPerEmail; i++) {
            await expect(authenticateCredentials({ email, password: "errada" }, null, T0)).rejects.toThrow("Credenciais inválidas");
        }

        await expect(authenticateCredentials({ email, password: PASSWORD }, null, T0)).rejects.toThrow(/Muitas tentativas/);
    });

    test("registros com mais de 1 dia são apagados ao registrar um erro novo", async () => {
        await failTimes(3);

        await failTimes(1, { at: minutesLater(25 * 60) });

        expect(await db.loginFailure.count({ where: { createdAt: { lt: minutesLater(60) } } })).toBe(0);
    });
});
