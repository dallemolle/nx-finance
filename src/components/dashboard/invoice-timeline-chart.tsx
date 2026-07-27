"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import { StackedInvoiceBarChart } from "./stacked-invoice-bar-chart";
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
                <StackedInvoiceBarChart data={data} />
            </CardContent>
        </Card>
    );
}
