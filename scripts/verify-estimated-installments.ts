// Script de verificação (sem banco): valida a matemática usada pelos dois ramos
// de parcelamento de "despesa prevista" em provisionEstimatedExpense
// (src/lib/credit-card-provision-actions.ts) — cartão via addInvoiceMonths
// (sem cálculo de closingDay, já que o usuário escolhe o mês direto) e
// genérica via addMonths + split decimal (mesma lógica de createTransaction).
import { Decimal } from "decimal.js";
import { addMonths } from "date-fns";
import { addInvoiceMonths, splitInstallments } from "../src/lib/credit-card-cycle";

function assertEqual(actual: unknown, expected: unknown, msg: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`FALHOU: ${msg}\n  esperado: ${e}\n  obtido:   ${a}`);
    }
    console.log(`OK: ${msg}`);
}

// --- Ramo "no cartão": estimativa de R$319,90 em 3x a partir de setembro/2026 ---
const cardInstallments = splitInstallments(new Decimal("319.90"), 3);
assertEqual(
    cardInstallments.map(s => s.value.toFixed(2)),
    ["106.63", "106.63", "106.64"],
    "estimativa no cartão: split de R$319,90 em 3x preserva centavo residual na última parcela"
);
const cardMonths = cardInstallments.map((_, i) => addInvoiceMonths(9, 2026, i));
assertEqual(
    cardMonths,
    [{ month: 9, year: 2026 }, { month: 10, year: 2026 }, { month: 11, year: 2026 }],
    "estimativa no cartão: parcelas caem em set/out/nov de 2026, partindo direto do mês escolhido (sem closingDay)"
);

// --- Ramo genérico: estimativa de R$100,00 em 3x a partir de dezembro/2026 (testa virada de ano) ---
const totalValue = new Decimal("100.00");
const count = 3;
const installmentValue = totalValue.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
const lastInstallmentValue = totalValue.minus(installmentValue.times(count - 1));
const genericValues = Array.from({ length: count }, (_, i) => (i === count - 1 ? lastInstallmentValue : installmentValue));
assertEqual(
    genericValues.map(v => v.toFixed(2)),
    ["33.33", "33.33", "33.34"],
    "estimativa genérica: split de R$100,00 em 3x preserva centavo residual na última parcela"
);

const startDate = new Date(2026, 11, 1); // dezembro/2026
const genericMonths = Array.from({ length: count }, (_, i) => {
    const d = addMonths(startDate, i);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
});
assertEqual(
    genericMonths,
    [{ month: 12, year: 2026 }, { month: 1, year: 2027 }, { month: 2, year: 2027 }],
    "estimativa genérica: parcelas caem em dez/2026, jan/2027, fev/2027 (virada de ano via addMonths)"
);

const genericTotal = genericValues.reduce((sum, v) => sum.plus(v), new Decimal(0));
assertEqual(genericTotal.toFixed(2), "100.00", "soma das parcelas genéricas splitadas bate exatamente com o total original");

console.log("\nTodos os testes de parcelamento de despesa prevista passaram.");
