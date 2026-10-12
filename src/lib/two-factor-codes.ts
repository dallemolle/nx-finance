import { createHash, randomInt } from "node:crypto";

// Códigos de recuperação do 2FA (BL-021). Funções puras, sem banco.

export const RECOVERY_CODE_COUNT = 10;

// Sem 0/O e 1/I, que se confundem ao copiar à mão. 32 símbolos x 10 posições
// = 50 bits por código: inviável de adivinhar, por isso o hash pode ser rápido.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

function randomCode(): string {
    const chars = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]);
    return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

export function generateRecoveryCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) codes.add(randomCode());
    return [...codes];
}

// O usuário pode digitar em minúscula, com espaço ou sem o hífen.
export function normalizeRecoveryCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(input: string): string {
    return createHash("sha256").update(normalizeRecoveryCode(input)).digest("hex");
}

// Código de 6 dígitos vem do app autenticador; qualquer outra coisa é
// tratada como código de recuperação.
export function isTotpCode(input: string): boolean {
    return /^\d{6}$/.test(input.trim());
}
