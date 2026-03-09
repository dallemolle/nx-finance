import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface SummaryCardsProps {
    summary: {
        saldoTotal: number;
        totalEntradas: number;
        totalSaidas: number;
        deltaEntradas: number;
        deltaSaidas: number;
        deltaSaldo: number;
    };
}

export function SummaryCards({ summary }: SummaryCardsProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const Variation = ({ value }: { value: number }) => {
        const isPositive = value >= 0;
        return (
            <div className={`flex items-center text-xs font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? '+' : ''}{value.toFixed(1)}%
                <span className="text-muted-foreground ml-1">vs mês anterior</span>
            </div>
        );
    };

    return (
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="relative overflow-hidden border-none shadow-2xl bg-slate-950 text-white">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Wallet className="w-24 h-24" />
                </div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Saldo Disponível</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    <div className="text-4xl font-extrabold tracking-tighter">
                        {formatCurrency(summary.saldoTotal)}
                    </div>
                    <div className="flex items-center text-xs text-slate-400">
                        {summary.deltaSaldo >= 0 ? (
                            <TrendingUp className="w-3 h-3 mr-1 text-emerald-400" />
                        ) : (
                            <TrendingDown className="w-3 h-3 mr-1 text-rose-400" />
                        )}
                        <span className={summary.deltaSaldo >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {Math.abs(summary.deltaSaldo).toFixed(1)}%
                        </span>
                        <span className="ml-1 opacity-60 text-[10px]">desde o último mês</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Entradas</CardTitle>
                    <div className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                        <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 italic">
                        {formatCurrency(summary.totalEntradas)}
                    </div>
                    <Variation value={summary.deltaEntradas} />
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saídas</CardTitle>
                    <div className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/30">
                        <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 italic">
                        {formatCurrency(summary.totalSaidas)}
                    </div>
                    <Variation value={summary.deltaSaidas} />
                </CardContent>
            </Card>
        </div>
    );
}
