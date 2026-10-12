import { describe, expect, test } from "vitest";
import {
    addMonthsDateOnly,
    currentMonthInAppZone,
    dateOnlyParts,
    dateOnlyToLocal,
    dateOnlyUtc,
    dateOnlyYmd,
    formatDateOnly,
    monthRange,
    toDateOnly,
    todayDateOnly,
} from "./date-only";

describe("ambiente dos testes", () => {
    test("roda no fuso de Brasília (vitest.config.ts)", () => {
        expect(new Date("2026-10-06T00:00:00Z").getDate()).toBe(5);
    });
});

describe("toDateOnly", () => {
    test("texto AAAA-MM-DD vira meia-noite UTC do mesmo dia", () => {
        expect(toDateOnly("2026-10-06").toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("meia-noite local de Brasília (data escolhida no calendário) mantém o dia", () => {
        expect(toDateOnly(new Date(2026, 9, 6)).toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("data já gravada (meia-noite UTC) não muda", () => {
        expect(toDateOnly(new Date("2026-10-06T00:00:00Z")).toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("agora, às 22h de Brasília (já é o dia seguinte em UTC), fica no dia de Brasília", () => {
        expect(toDateOnly(new Date("2026-10-07T01:00:00Z")).toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("texto ISO com hora é tratado como instante", () => {
        expect(toDateOnly("2026-10-06T03:00:00.000Z").toISOString()).toBe("2026-10-06T00:00:00.000Z");
    });

    test("data inválida continua inválida (o Zod rejeita)", () => {
        expect(Number.isNaN(toDateOnly("abc").getTime())).toBe(true);
    });
});

describe("leitura de uma data gravada", () => {
    // Compra de 06/10 importada do CSV: gravada à meia-noite UTC.
    const imported = new Date("2026-10-06T00:00:00Z");

    test("formatDateOnly mostra o dia certo em Brasília", () => {
        expect(formatDateOnly(imported, "dd 'de' MMMM")).toBe("06 de outubro");
        expect(formatDateOnly("2026-10-06T00:00:00.000Z", "dd/MM/yyyy")).toBe("06/10/2026");
    });

    test("dados gravados pelo formulário antigo (03:00 UTC) mostram o mesmo dia", () => {
        expect(formatDateOnly(new Date("2026-10-06T03:00:00Z"), "dd/MM")).toBe("06/10");
    });

    test("dateOnlyParts, dateOnlyYmd e dateOnlyToLocal usam o dia gravado", () => {
        expect(dateOnlyParts(imported)).toEqual({ year: 2026, month: 10, day: 6 });
        expect(dateOnlyYmd(imported)).toBe("2026-10-06");
        const local = dateOnlyToLocal(imported);
        expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours()]).toEqual([2026, 9, 6, 0]);
    });
});

describe("monthRange", () => {
    test("vai da meia-noite UTC do dia 1º até (exclusive) o dia 1º do mês seguinte", () => {
        const r = monthRange(2026, 10);
        expect(r.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
        expect(r.lt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    });

    test("compra do dia 1º fica no mês certo, inclusive dezembro -> janeiro", () => {
        const r = monthRange(2026, 12);
        const firstOfDec = toDateOnly("2026-12-01");
        expect(firstOfDec >= r.gte && firstOfDec < r.lt).toBe(true);
        expect(r.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
});

describe("addMonthsDateOnly", () => {
    test("soma meses mantendo o dia", () => {
        expect(dateOnlyYmd(addMonthsDateOnly(toDateOnly("2026-10-08"), 1))).toBe("2026-11-08");
    });

    test("dia inexistente cai no último dia do mês", () => {
        expect(dateOnlyYmd(addMonthsDateOnly(toDateOnly("2026-01-31"), 1))).toBe("2026-02-28");
    });

    test("atravessa o ano", () => {
        expect(dateOnlyYmd(addMonthsDateOnly(toDateOnly("2026-11-15"), 3))).toBe("2027-02-15");
    });
});

describe("hoje e mês corrente no fuso do app", () => {
    // 31/10 às 22h em Brasília = 01/11 01:00 UTC (servidor de produção roda em UTC).
    const lateOnOct31 = new Date("2026-11-01T01:00:00Z");

    test("todayDateOnly é o dia de Brasília", () => {
        expect(dateOnlyYmd(todayDateOnly(lateOnOct31))).toBe("2026-10-31");
    });

    test("currentMonthInAppZone é o mês de Brasília", () => {
        expect(currentMonthInAppZone(lateOnOct31)).toEqual({ year: 2026, month: 10 });
    });
});

describe("dateOnlyUtc", () => {
    test("monta a meia-noite UTC (mês 1-12)", () => {
        expect(dateOnlyUtc(2026, 2, 28).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    });
});
