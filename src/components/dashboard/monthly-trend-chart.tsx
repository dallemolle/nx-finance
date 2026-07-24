"use client";

import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MonthlyTrendChartProps {
    data: { label: string; saldo: number }[];
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tendência (6 meses)</CardTitle>
                <TrendingUp className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent className="pb-2">
                <div className="h-[120px] w-full -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                className="text-[10px] fill-muted-foreground capitalize"
                            />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{
                                    borderRadius: "12px",
                                    border: "none",
                                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="saldo"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#saldoGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
