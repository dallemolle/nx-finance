import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { actionResult, unwrap, userFacingMessage } from "./action-result";

// BL-044: erro esperado volta como valor, com mensagem que pode ir pra tela.
describe("userFacingMessage", () => {
    test("regra do app (Error comum): a própria mensagem", () => {
        expect(userFacingMessage(new Error("Senha incorreta"), "x")).toBe("Senha incorreta");
    });

    test("validação (Zod): a primeira mensagem, não o JSON", () => {
        const error = z.object({ nome: z.string().min(1, "Nome é obrigatório") }).safeParse({ nome: "" }).error;
        expect(userFacingMessage(error, "x")).toBe("Nome é obrigatório");
    });

    test("código conhecido do Prisma: a tradução", () => {
        const error = new Prisma.PrismaClientKnownRequestError("raw", { code: "P2025", clientVersion: "6" });
        expect(userFacingMessage(error, "x")).toBe("Registro não encontrado ou já foi removido.");
    });

    test("erro técnico (Prisma sem código, outras classes, não-Error): a genérica", () => {
        expect(userFacingMessage(new Prisma.PrismaClientValidationError("Invalid `prisma.x()` invocation...", { clientVersion: "6" }), "Erro ao salvar")).toBe("Erro ao salvar");
        expect(userFacingMessage(new TypeError("Cannot read properties of undefined"), "Erro ao salvar")).toBe("Erro ao salvar");
        expect(userFacingMessage("texto", "Erro ao salvar")).toBe("Erro ao salvar");
        expect(userFacingMessage(new Error(""), "Erro ao salvar")).toBe("Erro ao salvar");
    });
});

describe("actionResult e unwrap", () => {
    test("sucesso: o dado passa", async () => {
        const result = await actionResult("x", async () => 42);
        expect(result).toEqual({ success: true, data: 42 });
        expect(unwrap(result)).toBe(42);
    });

    test("erro: vira valor, e unwrap lança de novo com a mesma mensagem (no navegador)", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const result = await actionResult("Erro ao excluir", async () => { throw new Error("Volte o status para Pendente"); });

        expect(result).toEqual({ success: false, error: "Volte o status para Pendente" });
        expect(() => unwrap(result)).toThrow("Volte o status para Pendente");
    });
});
