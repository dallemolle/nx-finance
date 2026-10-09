import { Decimal } from "decimal.js";
import {
    getInvoiceReferenceMonth,
    addInvoiceMonths,
    computeInvoiceDueDate,
    getReferenceMonthFromDueDate,
    splitInstallments,
} from "../src/lib/credit-card-cycle";

function assertEqual(actual: unknown, expected: unknown, msg: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`FALHOU: ${msg}\n  esperado: ${e}\n  obtido:   ${a}`);
    }
    console.log(`OK: ${msg}`);
}

// Cartão fecha dia 25, vence dia 5 (dueDay <= closingDay -> caso comum)
const closingDay = 25;
const dueDay = 5;

// Compra em 27/07/2026 (dia 27 >= 25 -> cai na fatura de agosto)
const ref = getInvoiceReferenceMonth(new Date(2026, 6, 27), closingDay);
assertEqual(ref, { month: 8, year: 2026 }, "compra dia 27 (>= fechamento 25) cai na fatura de agosto/2026");

// Compra em 20/07/2026 (dia 20 < 25 -> cai na fatura de julho)
const refBefore = getInvoiceReferenceMonth(new Date(2026, 6, 20), closingDay);
assertEqual(refBefore, { month: 7, year: 2026 }, "compra dia 20 (< fechamento 25) cai na fatura de julho/2026");

// 3 parcelas a partir de agosto -> agosto, setembro, outubro
assertEqual(addInvoiceMonths(ref.month, ref.year, 0), { month: 8, year: 2026 }, "parcela 1/3 -> agosto/2026");
assertEqual(addInvoiceMonths(ref.month, ref.year, 1), { month: 9, year: 2026 }, "parcela 2/3 -> setembro/2026");
assertEqual(addInvoiceMonths(ref.month, ref.year, 2), { month: 10, year: 2026 }, "parcela 3/3 -> outubro/2026");

// Virada de ano: parcela de referência em novembro/2026 + 2 meses -> janeiro/2027
assertEqual(addInvoiceMonths(11, 2026, 2), { month: 1, year: 2027 }, "novembro/2026 + 2 meses -> janeiro/2027 (virada de ano)");

// Vencimento: fatura de agosto/2026 (dueDay 5 <= closingDay 25) -> vence em setembro, dia 5
assertEqual(
    computeInvoiceDueDate(8, 2026, closingDay, dueDay).toISOString().slice(0, 10),
    "2026-09-05",
    "fatura de agosto/2026 (fecha 25/vence 5) vence em 05/09/2026"
);

// Caso dueDay > closingDay (ex: fecha dia 5, vence dia 15) -> vence no mesmo mês da fatura
assertEqual(
    computeInvoiceDueDate(8, 2026, 5, 15).toISOString().slice(0, 10),
    "2026-08-15",
    "fatura de agosto/2026 (fecha 5/vence 15) vence em 15/08/2026 (mesmo mês)"
);

// Clamp de dia inexistente: vencimento dia 31 em fevereiro -> cai no último dia do mês
assertEqual(
    computeInvoiceDueDate(2, 2027, 5, 31).toISOString().slice(0, 10),
    "2027-02-28",
    "vencimento dia 31 em fevereiro/2027 (não bissexto) cai em 28/02/2027"
);

// getReferenceMonthFromDueDate é o inverso de computeInvoiceDueDate: round-trip
// deve voltar ao mês de referência original, nos dois regimes (dueDay <= closingDay
// e dueDay > closingDay).
const dueA = computeInvoiceDueDate(8, 2026, closingDay, dueDay); // fecha 25/vence 5
assertEqual(
    getReferenceMonthFromDueDate(dueA, closingDay, dueDay),
    { month: 8, year: 2026 },
    "round-trip: vencimento da fatura de agosto/2026 (fecha25/vence5) volta pro mês de referência agosto/2026"
);
const dueB = computeInvoiceDueDate(8, 2026, 5, 15); // fecha 5/vence 15
assertEqual(
    getReferenceMonthFromDueDate(dueB, 5, 15),
    { month: 8, year: 2026 },
    "round-trip: vencimento da fatura de agosto/2026 (fecha5/vence15) volta pro mês de referência agosto/2026"
);
// Virada de ano no sentido inverso: vencimento em janeiro/2027 (fecha25/vence5) -> referência dezembro/2026
assertEqual(
    getReferenceMonthFromDueDate(new Date(2027, 0, 5), closingDay, dueDay),
    { month: 12, year: 2026 },
    "round-trip: vencimento 05/01/2027 (fecha25/vence5) volta pro mês de referência dezembro/2026"
);

// Split de valor: R$ 319,90 em 3 parcelas -> 106.63 + 106.63 + 106.64 (última absorve o residual)
const split = splitInstallments(new Decimal("319.90"), 3);
assertEqual(split.map(s => s.value.toFixed(2)), ["106.63", "106.63", "106.64"], "split de R$319,90 em 3x preserva centavo residual na última parcela");
const total = split.reduce((sum, s) => sum.plus(s.value), new Decimal(0));
assertEqual(total.toFixed(2), "319.90", "soma das parcelas splitadas bate exatamente com o total original");

console.log("\nTodos os testes de ciclo de fatura passaram.");
