"use client";

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CardInstallmentPurchaseDialog } from "./card-installment-purchase-dialog";
import { EstimatedExpenseDialog } from "./estimated-expense-dialog";

interface InvoiceTimelineChartProps {
    userId: string;
    data: { label: string; confirmed: number; provisioned: number; total: number }[];
}

export function InvoiceTimelineChart({ userId, data }: InvoiceTimelineChartProps) {
    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Linha do Tempo de Faturas</CardTitle>
                    <CalendarRange className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex items-center gap-2">
                    <CardInstallmentPurchaseDialog userId={userId} />
                    <EstimatedExpenseDialog userId={userId} />
                </div>
            </CardHeader>
            <CardContent className="pb-2">
                <div className="h-[220px] w-full -ml-2">
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
            </CardContent>
        </Card>
    );
}
