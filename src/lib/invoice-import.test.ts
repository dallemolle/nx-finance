import { describe, expect, test } from "vitest";
import {
    applyCategory,
    applyCategoryToUncategorized,
    buildInvoiceDefaults,
    installmentShortcut,
    currentMonthDueDate,
    missingStepOneFields,
    parseInvoiceAmount,
    parseInvoiceDate,
} from "./invoice-import";

const today = new Date(2026, 9, 9); // 09/10/2026

describe("parseInvoiceDate (BL-024)", () => {
    test.each([
        ["2026-10-02", "2026-10-02"],
        ["02/10/2026", "2026-10-02"], // dia/mês, padrão brasileiro
        ["2/3/2026", "2026-03-02"],
        ["02/10/26", "2026-10-02"],
        ["  2026-10-02  ", "2026-10-02"],
    ])("%s -> %s", (raw, expected) => {
        expect(parseInvoiceDate(raw, today)).toBe(expected);
    });

    test("data ilegível cai na data de referência", () => {
        expect(parseInvoiceDate("ontem", today)).toBe("2026-10-09");
        expect(parseInvoiceDate("", today)).toBe("2026-10-09");
    });
});

describe("parseInvoiceAmount (BL-024)", () => {
    test.each([
        ["245.90", 245.9],
        ["245,90", 245.9],
        ["R$ 1.234,56", 1234.56],
        ["1,234.56", 1234.56],
        ["-74,50", -74.5],
        ["R$ -74,50", -74.5],
        ["1.000", 1000],
        ["", 0],
        ["abc", 0],
    ])("%s -> %d", (raw, expected) => {
        expect(parseInvoiceAmount(raw)).toBeCloseTo(expected, 2);
    });
});

describe("currentMonthDueDate (BL-027)", () => {
    test("vencimento ainda por vir neste mês", () => {
        expect(currentMonthDueDate(10, today)).toBe("2026-10-10");
    });

    test("vencimento hoje", () => {
        expect(currentMonthDueDate(9, today)).toBe("2026-10-09");
    });

    test("vencimento que já passou continua no mês corrente: o lançamento da fatura pode atrasar", () => {
        // caso real: fatura do Nubank que venceu em 08/10, importada em 09/10
        expect(currentMonthDueDate(8, today)).toBe("2026-10-08");
    });

    test("dia inexistente no mês cai no último dia", () => {
        expect(currentMonthDueDate(31, new Date(2027, 1, 1))).toBe("2027-02-28");
    });

    test("dezembro não vira o ano", () => {
        expect(currentMonthDueDate(5, new Date(2026, 11, 20))).toBe("2026-12-05");
    });
});

describe("buildInvoiceDefaults (BL-001)", () => {
    const card = { id: "c1", nome: "Nubank", dueDay: 5, institution_id: "inst-nu" };
    const paymentMethods = [
        { id: "pm-pix", nome: "Pix" },
        { id: "pm-cc", nome: "Cartão de crédito" },
    ];

    test("preenche instituição, vencimento, meio de pagamento e descrição a partir do cartão", () => {
        expect(buildInvoiceDefaults({ card, paymentMethods, today })).toEqual({
            institutionId: "inst-nu",
            dueDate: "2026-10-05",
            paymentMethodId: "pm-cc",
            description: "Fatura Nubank Out/2026",
        });
    });

    test("reconhece o meio de pagamento sem depender de acento ou maiúscula", () => {
        const pms = [{ id: "x", nome: "CARTAO DE CREDITO" }];
        expect(buildInvoiceDefaults({ card, paymentMethods: pms, today }).paymentMethodId).toBe("x");
    });

    test("não escolhe o meio 'Cartão (Provisionado)', que é interno", () => {
        const pms = [{ id: "prov", nome: "Cartão (Provisionado)" }];
        expect(buildInvoiceDefaults({ card, paymentMethods: pms, today }).paymentMethodId).toBeNull();
    });
});

describe("installmentShortcut (BL-006)", () => {
    test.each([
        ["Magazine Luiza - Parcela 1/10", { number: 1, total: 10 }],
        ["Amazon Marketplace Parcela 3/6", { number: 3, total: 6 }],
    ])("oferece o atalho para %s", (title, expected) => {
        expect(installmentShortcut(title)).toEqual(expected);
    });

    test("não oferece para a última parcela: não há nada a projetar", () => {
        expect(installmentShortcut("Localiza - Parcela 3/3")).toBeNull();
    });

    test("não oferece quando a descrição não tem parcela", () => {
        expect(installmentShortcut("Posto Shell")).toBeNull();
    });
});

describe("aplicação de categoria (BL-002)", () => {
    const rows = [
        { id: 0, title: "UBER *TRIP 1234", category_id: "" },
        { id: 1, title: "UBER *TRIP 9876", category_id: "" },
        { id: 2, title: "Netflix.com", category_id: "" },
        { id: 3, title: "UBER *TRIP 5555", category_id: "cat-ja-escolhida" },
    ];

    test("escolher a categoria de um item aplica aos outros sem categoria do mesmo estabelecimento", () => {
        const result = applyCategory(rows, 0, "cat-transporte");
        expect(result.map(r => r.category_id)).toEqual(["cat-transporte", "cat-transporte", "", "cat-ja-escolhida"]);
    });

    test("não altera a lista original", () => {
        applyCategory(rows, 0, "cat-transporte");
        expect(rows[1].category_id).toBe("");
    });

    test("aplicar a todos sem categoria preserva o que já foi escolhido", () => {
        const result = applyCategoryToUncategorized(rows, "cat-outros");
        expect(result.map(r => r.category_id)).toEqual(["cat-outros", "cat-outros", "cat-outros", "cat-ja-escolhida"]);
    });
});

describe("missingStepOneFields (BL-002)", () => {
    const complete = { hasFile: true, description: "Fatura", dueDate: "2026-11-05", institutionId: "i", paymentMethodId: "p" };

    test("nada falta quando tudo está preenchido", () => {
        expect(missingStepOneFields(complete)).toEqual([]);
    });

    test("lista o que falta, na ordem da tela", () => {
        expect(missingStepOneFields({ hasFile: false, description: "  ", dueDate: "", institutionId: "", paymentMethodId: "none" })).toEqual([
            "arquivo CSV",
            "descrição",
            "vencimento",
            "instituição",
            "meio de pagamento",
        ]);
    });
});
