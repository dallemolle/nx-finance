import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Datas sem hora (vencimento, data da compra) são gravadas como meia-noite UTC
// do dia do calendário, e lidas sempre pelos campos UTC. Antes, a importação
// gravava meia-noite UTC e as telas formatavam no fuso do navegador, então em
// Brasília (UTC-3) tudo aparecia um dia antes (BL-025).
//
// Nunca use `format(new Date(data))`, `getMonth()`/`getDate()` ou
// `startOfMonth`/`endOfMonth` do date-fns com essas datas: eles usam o fuso
// local (do navegador, ou do servidor — UTC em produção, Brasília no dev).
// Use as funções deste módulo.

// Fuso do usuário: define "hoje" e o dia de um instante (ex.: um lançamento
// criado às 22h de Brasília, que já é o dia seguinte em UTC).
export const APP_TIME_ZONE = "America/Sao_Paulo";

export interface DateParts {
    year: number;
    month: number; // 1-12
    day: number;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

const appZoneFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function partsInAppZone(instant: Date): DateParts {
    const get = (type: string) => Number(appZoneFormatter.formatToParts(instant).find(p => p.type === type)?.value);
    return { year: get("year"), month: get("month"), day: get("day") };
}

const isUtcMidnight = (d: Date) =>
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

// Meia-noite UTC de ano/mês (1-12)/dia. Mês ou dia fora do intervalo rolam
// para o mês/ano seguinte, como em Date.UTC.
export function dateOnlyUtc(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
}

export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Normaliza qualquer entrada para a convenção (meia-noite UTC do dia):
// - "AAAA-MM-DD" é o próprio dia;
// - um valor já à meia-noite UTC (data gravada) fica como está;
// - qualquer outro instante (data escolhida no calendário, que é meia-noite
//   local, ou "agora") vira o dia do calendário em Brasília.
export function toDateOnly(value: Date | string | number): Date {
    if (typeof value === "string") {
        const m = YMD.exec(value.trim());
        if (m) return dateOnlyUtc(Number(m[1]), Number(m[2]), Number(m[3]));
    }
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime()) || isUtcMidnight(d)) return d;
    const { year, month, day } = partsInAppZone(d);
    return dateOnlyUtc(year, month, day);
}

export function dateOnlyParts(value: Date | string): DateParts {
    const d = toDateOnly(value);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function dateOnlyYmd(value: Date | string): string {
    const { year, month, day } = dateOnlyParts(value);
    return `${year}-${pad(month)}-${pad(day)}`;
}

// Mesma data à meia-noite local, para componentes que trabalham no fuso local
// (calendário, date-fns).
export function dateOnlyToLocal(value: Date | string): Date {
    const { year, month, day } = dateOnlyParts(value);
    return new Date(year, month - 1, day);
}

export function formatDateOnly(value: Date | string, pattern: string): string {
    return format(dateOnlyToLocal(value), pattern, { locale: ptBR });
}

// Intervalo de um mês para filtros do Prisma: { gte, lt }.
export function monthRange(year: number, month: number): { gte: Date; lt: Date } {
    return { gte: dateOnlyUtc(year, month, 1), lt: dateOnlyUtc(year, month + 1, 1) };
}

// Soma meses mantendo o dia; se o dia não existe no mês de destino, usa o último.
export function addMonthsDateOnly(value: Date | string, months: number): Date {
    const { year, month, day } = dateOnlyParts(value);
    const total = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(total / 12);
    const targetMonth = (total % 12) + 1;
    return dateOnlyUtc(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function todayDateOnly(now: Date = new Date()): Date {
    const { year, month, day } = partsInAppZone(now);
    return dateOnlyUtc(year, month, day);
}

export function currentMonthInAppZone(now: Date = new Date()): { year: number; month: number } {
    const { year, month } = partsInAppZone(now);
    return { year, month };
}
