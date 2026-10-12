import { describe, expect, test } from "vitest";
import { formatCompactCurrency } from "./utils";

// O Intl usa espaço não separável depois do "R$"; normaliza pra comparar.
const plain = (s: string) => s.replace(/\s/g, " ");

// BL-008: valores curtos pros eixos e rótulos dos gráficos.
describe("formatCompactCurrency", () => {
    test("abaixo de mil, o valor inteiro", () => {
        expect(plain(formatCompactCurrency(0))).toBe("R$ 0");
        expect(plain(formatCompactCurrency(300))).toBe("R$ 300");
        expect(plain(formatCompactCurrency(999.4))).toBe("R$ 999");
    });

    test("a partir de mil, compacto com vírgula", () => {
        expect(plain(formatCompactCurrency(1234.56))).toBe("R$ 1,2 mil");
        expect(plain(formatCompactCurrency(2000))).toBe("R$ 2 mil");
        expect(plain(formatCompactCurrency(1_500_000))).toBe("R$ 1,5 mi");
    });

    test("negativo (saldo) mantém o sinal", () => {
        expect(plain(formatCompactCurrency(-2500))).toBe("-R$ 2,5 mil");
    });
});
