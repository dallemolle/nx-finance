"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { CalendarRange, TrendingUp } from "lucide-react";

interface BudgetCommitmentChartProps {
    data: {
        month: number;
        year: number;
        label: string;
        efetivado: number;
        provisionado: number;
    }[];
}

export function BudgetCommitmentChart({ data }: BudgetCommitmentChartProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

    const totalProvisionado = data.reduce((acc, m) => acc + m.provisionado, 0);
    const totalEfetivado = data.reduce((acc, m) => acc + m.efetivado, 0);

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                        Comprometimento Orçamentário
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Projeção de gastos efetivados vs. provisionados nos próximos meses
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                        <span className="text-muted-foreground">Efetivado</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-amber-400" />
                        <span className="text-muted-foreground">Provisionado</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {data.length > 0 && (totalEfetivado > 0 || totalProvisionado > 0) ? (
                    <div className="space-y-4">
                        <div className="flex gap-6 text-sm">
                            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <span className="text-muted-foreground">Total efetivado:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalEfetivado)}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                <CalendarRange className="w-4 h-4 text-amber-500" />
                                <span className="text-muted-foreground">Total provisionado:</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalProvisionado)}</span>
                            </div>
                        </div>

                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 11, className: "fill-slate-500 dark:fill-slate-400" }}
                                        axisLine={{ className: "stroke-slate-200 dark:stroke-slate-800" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                                        tick={{ fontSize: 11, className: "fill-slate-500 dark:fill-slate-400" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={(value: number, name: string) => {
                                            const label = name === "efetivado" ? "Efetivado" : "Provisionado";
                                            return [formatCurrency(value), label];
                                        }}
                                        labelFormatter={(label: string) => `Mês: ${label}`}
                                        contentStyle={{
                                            borderRadius: "12px",
                                            border: "none",
                                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                                            backdropFilter: "blur(4px)",
                                        }}
                                        cursor={{ fill: "rgba(0,0,0,0.03)" }}
                                    />
                                    <Legend
                                        formatter={(value: string) => {
                                            return value === "efetivado" ? "Efetivado" : "Provisionado";
                                        }}
                                        wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                                    />
                                    <Bar
                                        dataKey="efetivado"
                                        name="efetivado"
                                        stackId="a"
                                        fill="#10b981"
                                        radius={[0, 0, 0, 0]}
                                        className="drop-shadow-sm"
                                    />
                                    <Bar
                                        dataKey="provisionado"
                                        name="provisionado"
                                        stackId="a"
                                        fill="#f59e0b"
                                        radius={[4, 4, 0, 0]}
                                        className="drop-shadow-sm"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                            {data.filter(m => m.provisionado > 0 || m.efetivado > 0).slice(0, 4).map((m) => {
                                const total = m.efetivado + m.provisionado;
                                const pctProvisionado = total > 0 ? (m.provisionado / total) * 100 : 0;
                                return (
                                    <div
                                        key={`${m.year}-${m.month}`}
                                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                                    >
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(total)}</div>
                                        <div className="flex items-center gap-1 mt-1">
                                            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-amber-400"
                                                    style={{ width: `${pctProvisionado}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                {pctProvisionado.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                            {formatCurrency(m.provisionado)} provisionado
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-[200px] w-full items-center justify-center text-muted-foreground italic">
                        Nenhum gasto provisionado ou efetivado nos próximos meses.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
