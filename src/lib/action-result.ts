import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getPrismaErrorMessage } from "@/lib/utils";

// Resultado das Server Actions chamadas pelo navegador (BL-044). Erro esperado
// volta como valor, não como exceção: no build de produção o React troca a
// mensagem de um erro lançado por Server Action por "Minified React error
// #441", e o usuário via esse texto em vez de "Senha incorreta". "Não
// autorizado" (getSessionUserId, fora do actionResult) continua lançando.
export type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

// Mensagem que pode ir pra tela: validação (Zod), códigos conhecidos do Prisma
// e os Error comuns lançados pelas regras do app. Outros erros (Prisma sem
// código mapeado, bibliotecas) trazem detalhe técnico: usa a genérica.
export function userFacingMessage(error: unknown, fallback: string): string {
    if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
    if (error instanceof Prisma.PrismaClientKnownRequestError) return getPrismaErrorMessage(error, fallback);
    if (error instanceof Error && error.constructor === Error && error.message) return error.message;
    return fallback;
}

export async function actionResult<T>(fallback: string, run: () => Promise<T>): Promise<ActionResult<T>> {
    try {
        return { success: true, data: await run() };
    } catch (error: unknown) {
        console.error(`${fallback}:`, error);
        return { success: false, error: userFacingMessage(error, fallback) };
    }
}

// No navegador: devolve o dado ou lança o erro com a mensagem — lançado aqui,
// do lado do cliente, ele não passa pelo React do servidor e chega inteiro ao
// try/catch + toast de cada tela.
export function unwrap<T>(result: ActionResult<T>): T {
    if (!result.success) throw new Error(result.error);
    return result.data;
}
