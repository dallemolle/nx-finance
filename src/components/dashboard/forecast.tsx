"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, AlertTriangle } from "lucide-react";

interface ForecastProps {
    forecast: number;
    daysPassed: number;
    totalDays: number;
}

export function Forecast({ forecast, daysPassed, totalDays }: ForecastProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projeção do Mês</CardTitle>
                <Calculator className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">{formatCurrency(forecast)}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Estimativa Final</span>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-tight">
                            Com base nos {daysPassed} dias decorridos, você deve fechar o mês com este valor em saídas.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                    <span>Dia {daysPassed}</span>
                    <div className="flex-1 mx-2 h-[1px] bg-slate-100 dark:bg-slate-800" />
                    <span>{totalDays} Dias no total</span>
                </div>
            </CardContent>
        </Card>
    );
}
