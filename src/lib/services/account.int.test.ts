import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { changePasswordForUser } from "./account";
import { authenticateCredentials, LOGIN_LIMITS } from "./authenticate";
import { changePassword } from "@/lib/account-actions";
import { registerUser } from "@/lib/auth-actions";
import { createUserWithCard, type Scenario } from "../../../test/fixtures";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

const CURRENT = "senha-atual-123";
const NEW = "senha-nova-456";
const input = (extra: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>> = {}) =>
    ({ currentPassword: CURRENT, newPassword: NEW, confirmPassword: NEW, ...extra });

// BL-042: alterar senha.
describe("changePasswordForUser", () => {
    let s: Scenario;
    const login = (password: string) => authenticateCredentials({ email: s.user.email, password }, null);

    beforeEach(async () => {
        s = await createUserWithCard();
        await db.user.update({ where: { id: s.user.id }, data: { password: await bcrypt.hash(CURRENT, 4) } });
    });

    test("com a senha atual certa: a nova passa a valer no login e a antiga não", async () => {
        await changePasswordForUser(s.user.id, input());

        expect(await login(NEW)).toEqual({ id: s.user.id, email: s.user.email });
        await expect(login(CURRENT)).rejects.toThrow("Credenciais inválidas");
    });

    test("senha atual errada não troca nada", async () => {
        await expect(changePasswordForUser(s.user.id, input({ currentPassword: "errada" }))).rejects.toThrow("Senha atual incorreta");

        expect(await login(CURRENT)).toBeTruthy();
    });

    test("recusa nova senha curta, confirmação diferente ou igual à atual", async () => {
        await expect(changePasswordForUser(s.user.id, input({ newPassword: "curta", confirmPassword: "curta" }))).rejects.toThrow(/8 caracteres/);
        await expect(changePasswordForUser(s.user.id, input({ confirmPassword: "outra-coisa-789" }))).rejects.toThrow(/confirmação/);
        await expect(changePasswordForUser(s.user.id, input({ newPassword: CURRENT, confirmPassword: CURRENT }))).rejects.toThrow(/diferente da atual/);
        expect(await login(CURRENT)).toBeTruthy();
    });

    // Sessão roubada não vira força bruta da senha: conta no mesmo limite do login (BL-036).
    test(`depois de ${LOGIN_LIMITS.maxPerEmail} senhas atuais erradas, bloqueia — até a certa`, async () => {
        for (let i = 0; i < LOGIN_LIMITS.maxPerEmail; i++) {
            await expect(changePasswordForUser(s.user.id, input({ currentPassword: "errada" }))).rejects.toThrow("Senha atual incorreta");
        }

        await expect(changePasswordForUser(s.user.id, input())).rejects.toThrow(/Muitas tentativas/);
        await expect(login(CURRENT)).rejects.toThrow(/Muitas tentativas/);
    });

    // Erro esperado volta como valor: lançado, chegaria ao navegador em produção
    // como "Minified React error #441", sem a mensagem.
    test("a action usa o usuário da sessão e devolve o erro como valor, com a mensagem legível", async () => {
        vi.mocked(getServerSession).mockResolvedValue({ user: { id: s.user.id } });

        expect(await changePassword(input({ confirmPassword: "outra-coisa-789" })))
            .toEqual({ success: false, error: "A confirmação não confere com a nova senha" });
        expect(await changePassword(input({ currentPassword: "errada" }))).toEqual({ success: false, error: "Senha atual incorreta" });
        expect(await changePassword(input())).toEqual({ success: true });
        expect(await login(NEW)).toBeTruthy();
    });
});

// BL-043: cadastro fechado por padrão.
describe("registerUser", () => {
    const email = () => `novo-${crypto.randomUUID()}@example.com`;
    afterEach(() => { vi.unstubAllEnvs(); });

    test("sem ALLOW_REGISTRATION: recusa e não cria o usuário", async () => {
        vi.stubEnv("ALLOW_REGISTRATION", "");
        const address = email();

        await expect(registerUser({ email: address, password: "senha-123" })).rejects.toThrow(/cadastro .* fechado/i);
        expect(await db.user.count({ where: { email: address } })).toBe(0);
    });

    test("com ALLOW_REGISTRATION=true: cria o usuário com as categorias padrão", async () => {
        vi.stubEnv("ALLOW_REGISTRATION", "true");
        const address = email();

        await registerUser({ email: address, password: "senha-123" });

        const user = await db.user.findUniqueOrThrow({ where: { email: address }, include: { categories: true } });
        expect(user.categories).toHaveLength(4);
    });
});
