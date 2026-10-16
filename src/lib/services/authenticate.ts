// Login por e-mail + senha (+ 2FA) com limite de tentativas (BL-036). Chamado
// pelo authorize() do NextAuth (auth.ts); fica aqui pra poder ser testado.
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifySecondFactor } from "@/lib/services/two-factor";

// 10 erros por e-mail ou 30 por IP numa janela de 15 minutos bloqueiam novas
// tentativas até a janela andar. O limite por IP é maior porque várias pessoas
// podem sair pelo mesmo IP. Compromisso conhecido: quem souber o seu e-mail
// consegue bloquear o seu login por 15 minutos errando a senha de propósito.
export const LOGIN_LIMITS = {
    windowMs: 15 * 60_000,
    maxPerEmail: 10,
    maxPerIp: 30,
    // Registros mais velhos que isso já não contam e são apagados.
    retentionMs: 24 * 60 * 60_000,
};

interface Credentials {
    email?: string;
    password?: string;
    code?: string;
}

interface ThrottleKey {
    key: string;
    max: number;
}

async function assertNotThrottled(keys: ThrottleKey[], now: Date) {
    const since = new Date(now.getTime() - LOGIN_LIMITS.windowMs);
    let unblockAt = 0;
    for (const { key, max } of keys) {
        const recent = await db.loginFailure.findMany({
            where: { key, createdAt: { gt: since } },
            orderBy: { createdAt: "desc" },
            take: max,
            select: { createdAt: true },
        });
        // Bloqueado até a max-ésima falha mais recente sair da janela.
        if (recent.length >= max) unblockAt = Math.max(unblockAt, recent[max - 1].createdAt.getTime() + LOGIN_LIMITS.windowMs);
    }
    if (unblockAt > 0) {
        const minutes = Math.max(1, Math.ceil((unblockAt - now.getTime()) / 60_000));
        throw new Error(`Muitas tentativas de login. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`);
    }
}

async function recordFailure(keys: ThrottleKey[], now: Date) {
    await db.loginFailure.createMany({ data: keys.map(({ key }) => ({ key, createdAt: now })) });
    await db.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - LOGIN_LIMITS.retentionMs) } } });
}

// Devolve o usuário autenticado, null se faltar e-mail/senha, ou lança:
// "Credenciais inválidas", "2FA_REQUIRED" (pede o código; não conta como erro),
// "Código de verificação inválido" ou "Muitas tentativas de login...".
// A mensagem de bloqueio é a mesma exista ou não o e-mail (não revela quem tem conta).
export async function authenticateCredentials(credentials: Credentials, ip: string | null, now: Date = new Date()) {
    if (!credentials.email || !credentials.password) return null;

    const emailKey: ThrottleKey = { key: `email:${credentials.email.trim().toLowerCase()}`, max: LOGIN_LIMITS.maxPerEmail };
    const keys = ip ? [emailKey, { key: `ip:${ip}`, max: LOGIN_LIMITS.maxPerIp }] : [emailKey];

    // Antes de comparar a senha: bloqueado não testa nada (nem gasta bcrypt).
    await assertNotThrottled(keys, now);

    const user = await db.user.findUnique({ where: { email: credentials.email } });
    if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
        await recordFailure(keys, now);
        throw new Error("Credenciais inválidas");
    }

    if (user.status_2fa) {
        if (!credentials.code) throw new Error("2FA_REQUIRED");
        // Código do app ou de recuperação (uso único) — BL-021.
        if (!(await verifySecondFactor(user, credentials.code))) {
            await recordFailure(keys, now);
            throw new Error("Código de verificação inválido");
        }
    }

    await db.loginFailure.deleteMany({ where: { key: emailKey.key } });
    return { id: user.id, email: user.email };
}

// Conferir a senha atual fora do login (alterar senha, BL-042) conta no mesmo
// limite por e-mail: uma sessão roubada não vira um jeito de adivinhar a senha
// sem limite. Lança "Senha atual incorreta" ou a mensagem de bloqueio.
export async function verifyCurrentPassword(user: { email: string; password: string }, password: string, now: Date = new Date()) {
    const keys: ThrottleKey[] = [{ key: `email:${user.email.trim().toLowerCase()}`, max: LOGIN_LIMITS.maxPerEmail }];
    await assertNotThrottled(keys, now);
    if (!(await bcrypt.compare(password, user.password))) {
        await recordFailure(keys, now);
        throw new Error("Senha atual incorreta");
    }
}
