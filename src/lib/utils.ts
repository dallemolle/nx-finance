import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Prisma } from "@prisma/client"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message || fallback;
    return fallback;
}

// Traduz os codigos de erro mais comuns do Prisma (constraint unica, FK, not found)
// para mensagens que fazem sentido pro usuario final, em vez do erro tecnico cru.
export function getPrismaErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2002":
                return "Já existe um registro com esses dados para este usuário.";
            case "P2025":
                return "Registro não encontrado ou já foi removido.";
            case "P2003":
                return "Operação inválida: um dos dados relacionados (categoria, meio de pagamento ou instituição) não existe.";
        }
    }
    return getErrorMessage(error, fallback);
}
