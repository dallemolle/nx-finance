"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarClock } from "lucide-react";
import { useState, useEffect } from "react";
import { getProvisionedBudget, MonthlyCommitment } from "@/lib/provisions";

export function CommittedBudget() {
    const [data, setData] = useState<MonthlyCommitment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getProvisionedBudget(12)
            .then(setData)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    const chartData = data.map(d => ({
        name: d.label,
        Provisionado: d.totalProvisioned,
        Realizado: d.totalRealized,
    }));

    const totalCommitted = data.reduce((s, d) => s + d.grandTotal, 0);

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Orçamento Comprometido
                </CardTitle>
                <CalendarClock className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        Carregando...
                    </div>
                ) : totalCommitted === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-sm">
                        Nenhum gasto futuro comprometido.
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">
                                {formatCurrency(totalCommitted)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                Comprometido em {data.length} meses
                            </span>
                        </div>

                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10 }}
                                        interval={1}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelFormatter={(label) => label}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                                    />
                                    <Bar
                                        dataKey="Provisionado"
                                        stackId="a"
                                        fill="#8b5cf6"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="Realizado"
                                        stackId="a"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                            {data.slice(0, 6).map((d) => (
                                <div
                                    key={`${d.month}-${d.year}`}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                                >
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                                        {d.label}
                                    </span>
                                    <span className="text-xs font-black text-rose-500">
                                        {formatCurrency(d.grandTotal)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
