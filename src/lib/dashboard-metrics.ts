import { getDaysInMonth } from "date-fns";

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
    const targetDate = new Date(year, month - 1);
    const totalDays = getDaysInMonth(targetDate);
    const isCurrentMonth = today.getMonth() === targetDate.getMonth() && today.getFullYear() === targetDate.getFullYear();
    if (!isCurrentMonth) return saidas.reduce((sum, s) => sum + s.valor, 0);

    // Só o que já aconteceu (até hoje) define o ritmo diário; despesas agendadas
    // pra depois de hoje já têm valor conhecido e entram uma vez, sem extrapolar.
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let realized = 0;
    let scheduled = 0;
    for (const s of saidas) {
        if (s.data < endOfToday) realized += s.valor;
        else scheduled += s.valor;
    }
    return (realized / today.getDate()) * totalDays + scheduled;
}

// % da receita comprometida pelo gasto; null quando não há receita no mês
// (não dá pra dizer que 100% foi gasto de uma receita que não existe).
export function incomeCommitmentPercent(spent: number, income: number): number | null {
    return income > 0 ? (spent / income) * 100 : null;
}
