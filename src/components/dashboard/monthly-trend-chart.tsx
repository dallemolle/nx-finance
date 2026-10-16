"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, type DotProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCompactCurrency, maskCurrency } from "@/lib/utils";
import { useIsPrivacyMode } from "./privacy-provider";
import { chartTooltipProps } from "./chart-tooltip";

interface MonthlyTrendChartProps {
    data: { label: string; saldo: number }[];
}

// Saldo (entradas - saídas) dos últimos 6 meses. Eixo Y, linha do zero e o
// valor do mês atual no fim da linha (BL-008).
export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
    const isHidden = useIsPrivacyMode();
    const lastIndex = data.length - 1;
    const hasNegative = data.some(d => d.saldo < 0);

    // Marcador + valor só no último ponto (rotular todos vira ruído). O valor
    // fica do lado oposto ao que a linha chega, pra não ficar em cima dela.
    const lineComesFromAbove = lastIndex > 0 && data[lastIndex - 1].saldo > data[lastIndex].saldo;
    const EndDot = (props: DotProps & { index?: number }) => {
        if (props.index !== lastIndex || props.cx == null || props.cy == null) return <g key={`dot-${props.index}`} />;
        return (
            <g key="dot-end">
                <circle cx={props.cx} cy={props.cy} r={4} className="fill-indigo-500 stroke-white dark:stroke-slate-900" strokeWidth={2} />
                {!isHidden && (
                    <text x={props.cx - 8} y={props.cy + (lineComesFromAbove ? 16 : -10)} textAnchor="end" className="text-[10px] font-semibold fill-slate-600 dark:fill-slate-300 tabular-nums">
                        {formatCompactCurrency(data[lastIndex].saldo)}
                    </text>
                )}
            </g>
        );
    };

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saldo · últimos 6 meses</CardTitle>
                <TrendingUp className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent className="pb-2">
                <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                className="text-[10px] fill-muted-foreground capitalize"
                            />
                            <YAxis
                                hide={isHidden}
                                width={56}
                                tickLine={false}
                                axisLine={false}
                                tickCount={3}
                                tickFormatter={formatCompactCurrency}
                                className="text-[10px] fill-muted-foreground tabular-nums"
                            />
                            {hasNegative && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />}
                            <Tooltip
                                formatter={(value: number) => [maskCurrency(value, isHidden), "Saldo"]}
                                {...chartTooltipProps}
                            />
                            <Area
                                type="monotone"
                                dataKey="saldo"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="#6366f1"
                                fillOpacity={0.1}
                                dot={EndDot}
                                activeDot={{ r: 4, strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
