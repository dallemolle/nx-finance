"use client";

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface StackedInvoiceBarChartProps {
    data: { label: string; confirmed: number; provisioned: number }[];
    height?: number;
}

// Barras empilhadas confirmado/provisionado — extraído de InvoiceTimelineChart
// pra ser reaproveitado também nas seções por cartão de /faturas.
export function StackedInvoiceBarChart({ data, height = 220 }: StackedInvoiceBarChartProps) {
    return (
        <div className="w-full -ml-2" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                    <Legend
                        formatter={(value) => (
                            <span className="text-xs text-muted-foreground">{value === "confirmed" ? "Confirmado" : "Provisionado"}</span>
                        )}
                    />
                    <Bar dataKey="confirmed" stackId="fatura" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="provisioned" stackId="fatura" fill="#f59e0b" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
