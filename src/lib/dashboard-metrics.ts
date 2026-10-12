import { currentMonthInAppZone, dateOnlyParts, daysInMonth, toDateOnly, todayDateOnly } from "./date-only";

export interface DatedOutflow {
    valor: number;
    data: Date;
}

export function projectMonthlyOutflow({ saidas, today, month, year }: {
    saidas: DatedOutflow[];
    today: Date;
    month: number;
    year: number;
}): number {
    const totalDays = daysInMonth(year, month);
    const current = currentMonthInAppZone(today);
    const isCurrentMonth = current.month === month && current.year === year;
    if (!isCurrentMonth) return saidas.reduce((sum, s) => sum + s.valor, 0);

    // Só o que já aconteceu (até hoje) define o ritmo diário; despesas agendadas
    // pra depois de hoje já têm valor conhecido e entram uma vez, sem extrapolar.
    // `data` vem do banco (meia-noite UTC do dia), então a comparação é por dia.
    const todayDate = todayDateOnly(today);
    let realized = 0;
    let scheduled = 0;
    for (const s of saidas) {
        if (toDateOnly(s.data) <= todayDate) realized += s.valor;
        else scheduled += s.valor;
    }
    return (realized / dateOnlyParts(todayDate).day) * totalDays + scheduled;
}

// % da receita comprometida pelo gasto; null quando não há receita no mês
// (não dá pra dizer que 100% foi gasto de uma receita que não existe).
export function incomeCommitmentPercent(spent: number, income: number): number | null {
    return income > 0 ? (spent / income) * 100 : null;
}

// Variação % em relação ao mês anterior. Divide pelo valor absoluto do mês
// anterior: com o saldo saindo de -100 pra +50, a variação é +150% (melhorou),
// não -150%. Sem valor no mês anterior, não há base de comparação: 0.
export function percentChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
}

const percentFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
});

// "+12,3%", "-4,0%", "0,0%" (BL-007: antes "12.3%", com ponto).
export function formatPercentChange(value: number): string {
    // Arredonda antes pra -0,01 não virar "-0,0%".
    const rounded = Math.round(value * 10) / 10;
    return `${percentFormatter.format(rounded === 0 ? 0 : rounded)}%`;
}

export type VariationTone = "good" | "bad" | "neutral";

// Se a variação é boa ou ruim depende do que se mede: entrada e saldo subindo
// é bom ("up"); saída subindo é ruim ("down"). Antes, saída subindo ficava verde.
export function variationTone(value: number, goodWhen: "up" | "down"): VariationTone {
    if (Math.abs(value) < 0.05) return "neutral";
    return (value > 0) === (goodWhen === "up") ? "good" : "bad";
}