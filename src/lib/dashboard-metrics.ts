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
