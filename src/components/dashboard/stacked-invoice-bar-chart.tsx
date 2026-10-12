"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Rectangle, ResponsiveContainer, Tooltip, type RectangleProps } from "recharts";
import { formatCompactCurrency, maskCurrency } from "@/lib/utils";
import { useIsPrivacyMode } from "./privacy-provider";

interface StackedInvoiceBarChartProps {
    data: { label: string; confirmed: number; provisioned: number }[];
    height?: number;
}

const SERIES = {
    confirmed: { name: "Confirmado", swatch: "bg-indigo-500" },
    provisioned: { name: "Previsto", swatch: "bg-amber-500 dark:bg-amber-600" },
} as const;

// Barras empilhadas confirmado/previsto por mês — usado na linha do tempo do
// dashboard e nas seções por cartão de /faturas. Eixo Y e total no topo de
// cada coluna (BL-008); legenda só com as séries que têm valor.
export function StackedInvoiceBarChart({ data, height = 220 }: StackedInvoiceBarChartProps) {
    const isHidden = useIsPrivacyMode();
    const rows = data.map(d => ({ ...d, total: d.confirmed + d.provisioned }));
    const series = (["confirmed", "provisioned"] as const).filter(key => rows.some(r => r[key] > 0));

    if (series.length === 0) {
        return (
            <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
                Nenhuma fatura nos próximos meses.
            </div>
        );
    }

    return (
        <div>
            {/* Cores das barras e o espaço de 2px entre segmentos (cor do card) via CSS, pra seguir o tema. */}
            <div
                className="w-full [&_.bar-confirmed_path]:fill-indigo-500 [&_.bar-provisioned_path]:fill-amber-500 dark:[&_.bar-provisioned_path]:fill-amber-600 [&_.recharts-bar-rectangle_path]:stroke-white dark:[&_.recharts-bar-rectangle_path]:stroke-slate-900"
                style={{ height }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
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
                            tickCount={4}
                            tickFormatter={formatCompactCurrency}
                            className="text-[10px] fill-muted-foreground tabular-nums"
                        />
                        <Tooltip
                            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                            formatter={(value: number, name: string) => [maskCurrency(value, isHidden), name]}
                            contentStyle={{
                                borderRadius: "12px",
                                border: "1px solid hsl(var(--border))",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                backgroundColor: "hsl(var(--popover))",
                                color: "hsl(var(--popover-foreground))",
                                fontSize: 12,
                            }}
                            labelClassName="capitalize font-semibold"
                        />
                        <Bar
                            dataKey="confirmed"
                            name={SERIES.confirmed.name}
                            stackId="fatura"
                            className="bar-confirmed"
                            maxBarSize={24}
                            strokeWidth={2}
                            // Topo arredondado só quando não há previsto empilhado em cima.
                            shape={(props: unknown) => {
                                const p = props as RectangleProps & { payload?: { provisioned: number } };
                                return <Rectangle {...p} radius={p.payload && p.payload.provisioned > 0 ? 0 : [4, 4, 0, 0]} />;
                            }}
                        />
                        <Bar
                            dataKey="provisioned"
                            name={SERIES.provisioned.name}
                            stackId="fatura"
                            className="bar-provisioned"
                            maxBarSize={24}
                            strokeWidth={2}
                            radius={[4, 4, 0, 0]}
                        >
                            {!isHidden && (
                                <LabelList
                                    dataKey="total"
                                    position="top"
                                    formatter={(v: number) => (v > 0 ? formatCompactCurrency(v) : "")}
                                    className="text-[10px] font-semibold fill-slate-600 dark:fill-slate-300 tabular-nums"
                                />
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 pt-1">
                {series.map(key => (
                    <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-sm ${SERIES[key].swatch}`} aria-hidden />
                        {SERIES[key].name}
                    </span>
                ))}
            </div>
        </div>
    );
}
