import { describe, expect, test } from "vitest";
import { generateRecoveryCodes, hashRecoveryCode, isTotpCode, normalizeRecoveryCode, RECOVERY_CODE_COUNT } from "./two-factor-codes";

// BL-021: códigos de recuperação do 2FA.
describe("generateRecoveryCodes", () => {
    test("gera 10 códigos no formato XXXXX-XXXXX, sem caracteres ambíguos", () => {
        const codes = generateRecoveryCodes();

        expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
        for (const code of codes) {
            expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
            expect(code).not.toMatch(/[01IO]/);
        }
    });

    test("códigos distintos entre si e entre gerações", () => {
        const all = [...generateRecoveryCodes(), ...generateRecoveryCodes()];

        expect(new Set(all).size).toBe(all.length);
    });
});

describe("normalizeRecoveryCode e hashRecoveryCode", () => {
    test("ignora maiúsculas, espaços e hífen ao comparar", () => {
        expect(normalizeRecoveryCode(" abcde-fgh23 ")).toBe("ABCDEFGH23");
        expect(hashRecoveryCode("abcde fgh23")).toBe(hashRecoveryCode("ABCDE-FGH23"));
    });

    test("o hash não contém o código e muda com o código", () => {
        const hash = hashRecoveryCode("ABCDE-FGH23");

        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain("ABCDE");
        expect(hashRecoveryCode("ABCDE-FGH24")).not.toBe(hash);
    });
});

describe("isTotpCode", () => {
    test("6 dígitos é código do app; o resto é tratado como código de recuperação", () => {
        expect(isTotpCode("123456")).toBe(true);
        expect(isTotpCode(" 123456 ")).toBe(true);
        expect(isTotpCode("12345")).toBe(false);
        expect(isTotpCode("ABCDE-FGH23")).toBe(false);
    });
});
