import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface SummaryCardsProps {
    summary: {
        saldoTotal: number;
        totalEntradas: number;
        totalSaidas: number;
    };
}

export function SummaryCards({ summary }: SummaryCardsProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium opacity-90">Saldo Total</CardTitle>
                    <Wallet className="w-4 h-4 opacity-90" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(summary.saldoTotal)}</div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-emerald-50 dark:bg-emerald-950/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Entradas</CardTitle>
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(summary.totalEntradas)}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-rose-50 dark:bg-rose-950/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">Total Saídas</CardTitle>
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                        {formatCurrency(summary.totalSaidas)}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
