import { describe, expect, test } from "vitest";
import { incomeCommitmentPercent, projectMonthlyOutflow } from "./dashboard-metrics";
import { toDateOnly } from "./date-only";

// Outubro/2026 tem 31 dias; "hoje" = dia 9.
const today = new Date(2026, 9, 9, 14, 0);

describe("projectMonthlyOutflow", () => {
    test("despesas agendadas pra depois de hoje entram uma vez só, sem inflar a média diária", () => {
        const saidas = [
            { valor: 139, data: new Date(2026, 9, 8) },     // já aconteceu
            { valor: 99.9, data: new Date(2026, 9, 10) },   // agendada
            { valor: 194.81, data: new Date(2026, 9, 29) }, // agendada
        ];

        const forecast = projectMonthlyOutflow({ saidas, today, month: 10, year: 2026 });

        // ritmo do que já foi gasto (139 em 9 dias) projetado pros 31 dias + agendadas
        expect(forecast).toBeCloseTo((139 / 9) * 31 + 99.9 + 194.81, 2);
    });

    test("despesa no próprio dia de hoje conta como já realizada", () => {
        const saidas = [{ valor: 90, data: new Date(2026, 9, 9) }];

        const forecast = projectMonthlyOutflow({ saidas, today, month: 10, year: 2026 });

        expect(forecast).toBeCloseTo((90 / 9) * 31, 2);
    });

    // BL-025: como vem do banco (meia-noite UTC). 10/10 00:00 UTC = 09/10 21:00 em Brasília.
    test("despesa gravada para amanhã continua agendada", () => {
        const saidas = [
            { valor: 90, data: toDateOnly("2026-10-09") },  // hoje
            { valor: 50, data: toDateOnly("2026-10-10") },  // amanhã
        ];

        const forecast = projectMonthlyOutflow({ saidas, today, month: 10, year: 2026 });

        expect(forecast).toBeCloseTo((90 / 9) * 31 + 50, 2);
    });

    test("às 22h do último dia do mês (já 1º em UTC) ainda é o mês corrente", () => {
        const lateOnOct31 = new Date("2026-11-01T01:00:00Z");
        const saidas = [{ valor: 310, data: toDateOnly("2026-10-15") }];

        expect(projectMonthlyOutflow({ saidas, today: lateOnOct31, month: 10, year: 2026 })).toBeCloseTo(310, 2);
    });

    test("mês passado: projeção é o total gasto, sem extrapolar", () => {
        const saidas = [
            { valor: 100, data: new Date(2026, 8, 5) },
            { valor: 50, data: new Date(2026, 8, 28) },
        ];

        expect(projectMonthlyOutflow({ saidas, today, month: 9, year: 2026 })).toBeCloseTo(150, 2);
    });

    test("mês futuro: projeção é só a soma do que está agendado", () => {
        const saidas = [{ valor: 300, data: new Date(2026, 10, 15) }];

        expect(projectMonthlyOutflow({ saidas, today, month: 11, year: 2026 })).toBeCloseTo(300, 2);
    });
});

describe("incomeCommitmentPercent", () => {
    test("sem receita no mês não há percentual a calcular", () => {
        expect(incomeCommitmentPercent(433.71, 0)).toBeNull();
    });

    test("com receita, é o gasto como % da receita", () => {
        expect(incomeCommitmentPercent(2500, 5000)).toBe(50);
    });
});
