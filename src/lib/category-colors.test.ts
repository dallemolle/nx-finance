import { describe, expect, test } from "vitest";
import { areColorsSimilar, CATEGORY_PALETTE, suggestCategoryColor } from "./category-colors";
import { OTHERS_CATEGORY_COLOR } from "./dashboard-utils";

// Sorteio "repetível" pros testes: percorre a sequência dada em loop.
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

describe("CATEGORY_PALETTE", () => {
    test("cores bem diferentes entre si e diferentes do cinza de \"Outros\"", () => {
        for (const [i, a] of CATEGORY_PALETTE.entries()) {
            expect(areColorsSimilar(a, OTHERS_CATEGORY_COLOR), a).toBe(false);
            for (const b of CATEGORY_PALETTE.slice(i + 1)) expect(areColorsSimilar(a, b), `${a} x ${b}`).toBe(false);
        }
    });
});

describe("areColorsSimilar", () => {
    test("mesma cor (com ou sem maiúsculas) e cores quase iguais são parecidas", () => {
        expect(areColorsSimilar("#3B82F6", "#3b82f6")).toBe(true);
        expect(areColorsSimilar("#3b82f6", "#3b83f8")).toBe(true);
    });

    test("cores de famílias diferentes não são", () => {
        expect(areColorsSimilar("#3b82f6", "#ef4444")).toBe(false);
    });
});

describe("suggestCategoryColor", () => {
    test("devolve uma cor hex válida", () => {
        expect(suggestCategoryColor([])).toMatch(/^#[0-9a-f]{6}$/);
    });

    test("nunca repete nem chega perto das cores já usadas", () => {
        const existing = CATEGORY_PALETTE.slice(0, CATEGORY_PALETTE.length - 3);
        for (let k = 0; k < 50; k++) {
            const color = suggestCategoryColor(existing);
            expect(existing.some(e => areColorsSimilar(e, color)), color).toBe(false);
        }
    });

    test("evita também uma cor quase igual a uma da paleta (ex.: escolhida à mão)", () => {
        const nearBlue = "#3b83f8";
        const existing = [...CATEGORY_PALETTE.filter(c => c !== "#3b82f6"), nearBlue];
        // Sobra só o azul da paleta, que é parecido com nearBlue: não pode escolhê-lo.
        expect(suggestCategoryColor(existing, seq(0))).not.toBe("#3b82f6");
    });

    test("ignora valores vazios ou inválidos na lista de existentes", () => {
        expect(suggestCategoryColor([null, undefined, "", "azul"], seq(0))).toBe(CATEGORY_PALETTE[0]);
    });

    test("o sorteio escolhe entre as cores livres", () => {
        const free = CATEGORY_PALETTE.slice(1);
        expect(suggestCategoryColor([CATEGORY_PALETTE[0]], seq(0))).toBe(free[0]);
        expect(suggestCategoryColor([CATEGORY_PALETTE[0]], seq(0.9999))).toBe(free[free.length - 1]);
    });

    test("com a paleta toda em uso, ainda sugere uma cor que não repete nenhuma", () => {
        const color = suggestCategoryColor(CATEGORY_PALETTE);

        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        expect(CATEGORY_PALETTE).not.toContain(color);
        expect(areColorsSimilar(color, OTHERS_CATEGORY_COLOR)).toBe(false);
    });
});
