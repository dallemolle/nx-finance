import { describe, expect, test } from "vitest";
import { Decimal } from "decimal.js";
import { format } from "date-fns";
import {
    addInvoiceMonths,
    computeInvoiceDueDate,
    getInvoiceReferenceMonth,
    getReferenceMonthFromDueDate,
    splitInstallments,
} from "./credit-card-cycle";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

// Cartão fecha dia 25, vence dia 5 (dueDay <= closingDay -> caso comum)
const closingDay = 25;
const dueDay = 5;

describe("getInvoiceReferenceMonth", () => {
    test("compra no dia do fechamento ou depois cai na fatura do mês seguinte", () => {
        expect(getInvoiceReferenceMonth(new Date(2026, 6, 27), closingDay)).toEqual({ month: 8, year: 2026 });
    });

    test("compra exatamente no dia do fechamento já cai na fatura seguinte", () => {
        expect(getInvoiceReferenceMonth(new Date(2026, 6, 25), closingDay)).toEqual({ month: 8, year: 2026 });
    });

    test("compra antes do fechamento cai na fatura do próprio mês", () => {
        expect(getInvoiceReferenceMonth(new Date(2026, 6, 20), closingDay)).toEqual({ month: 7, year: 2026 });
    });
});

describe("addInvoiceMonths", () => {
    test("parcelas avançam um mês por vez a partir da referência", () => {
        expect([0, 1, 2].map(i => addInvoiceMonths(8, 2026, i))).toEqual([
            { month: 8, year: 2026 },
            { month: 9, year: 2026 },
            { month: 10, year: 2026 },
        ]);
    });

    test("vira o ano corretamente", () => {
        expect(addInvoiceMonths(11, 2026, 2)).toEqual({ month: 1, year: 2027 });
    });
});

describe("computeInvoiceDueDate", () => {
    test("vencimento antes do fechamento: vence no mês seguinte ao da fatura", () => {
        expect(ymd(computeInvoiceDueDate(8, 2026, closingDay, dueDay))).toBe("2026-09-05");
    });

    test("vencimento depois do fechamento: vence no mesmo mês da fatura", () => {
        expect(ymd(computeInvoiceDueDate(8, 2026, 5, 15))).toBe("2026-08-15");
    });

    test("dia inexistente no mês cai no último dia (31 em fevereiro não bissexto)", () => {
        expect(ymd(computeInvoiceDueDate(2, 2027, 5, 31))).toBe("2027-02-28");
    });
});

describe("getReferenceMonthFromDueDate", () => {
    test("é o inverso de computeInvoiceDueDate quando vence depois de fechar (fecha 25/vence 5)", () => {
        const due = computeInvoiceDueDate(8, 2026, closingDay, dueDay);
        expect(getReferenceMonthFromDueDate(due, closingDay, dueDay)).toEqual({ month: 8, year: 2026 });
    });

    test("é o inverso de computeInvoiceDueDate quando vence no mesmo mês (fecha 5/vence 15)", () => {
        const due = computeInvoiceDueDate(8, 2026, 5, 15);
        expect(getReferenceMonthFromDueDate(due, 5, 15)).toEqual({ month: 8, year: 2026 });
    });

    test("vencimento em janeiro volta pra referência de dezembro do ano anterior", () => {
        expect(getReferenceMonthFromDueDate(new Date(2027, 0, 5), closingDay, dueDay)).toEqual({ month: 12, year: 2026 });
    });
});

describe("splitInstallments", () => {
    test("a última parcela absorve o centavo residual", () => {
        const split = splitInstallments(new Decimal("319.90"), 3);
        expect(split.map(s => s.value.toFixed(2))).toEqual(["106.63", "106.63", "106.64"]);
    });

    test("a soma das parcelas bate exatamente com o total", () => {
        const total = splitInstallments(new Decimal("319.90"), 3).reduce((sum, s) => sum.plus(s.value), new Decimal(0));
        expect(total.toFixed(2)).toBe("319.90");
    });

    test("estimativa no cartão: parcelas caem em meses consecutivos a partir do mês escolhido", () => {
        const months = splitInstallments(new Decimal("319.90"), 3).map((_, i) => addInvoiceMonths(9, 2026, i));
        expect(months).toEqual([
            { month: 9, year: 2026 },
            { month: 10, year: 2026 },
            { month: 11, year: 2026 },
        ]);
    });
});
