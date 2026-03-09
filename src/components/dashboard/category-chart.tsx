"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryChartProps {
    data: {
        name: string;
        value: number;
        fill: string;
    }[];
}

export function CategoryChart({ data }: CategoryChartProps) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

    return (
        <Card className="col-span-1 border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-slate-300">Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full relative">
                    {data.length > 0 ? (
                        <>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">{formatCurrency(total)}</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={95}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity outline-none" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                            backdropFilter: 'blur(4px)'
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground italic">
                            Nenhuma despesa este mês.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
