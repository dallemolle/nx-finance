"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MonthlyCommitmentCardProps {
    label: string;
    committedValue: number;
    incomeReference: number;
}

export function MonthlyCommitmentCard({ label, committedValue, incomeReference }: MonthlyCommitmentCardProps) {
    const percent = incomeReference > 0 ? (committedValue / incomeReference) * 100 : (committedValue > 0 ? 100 : 0);
    const clampedPercent = Math.min(percent, 100);

    const getStatus = () => {
        if (percent < 50) return { label: "Tranquilo", color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500" };
        if (percent < 80) return { label: "Moderado", color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-500" };
        if (percent < 100) return { label: "Alerta", color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500" };
        return { label: "Crítico", color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-500" };
    };

    const status = getStatus();

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Comprometimento — {label}</CardTitle>
                <CalendarClock className={`w-4 h-4 ${status.color}`} />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className={`text-xl font-black ${status.color}`}>{status.label}</span>
                    <span className="text-sm font-medium text-muted-foreground">{percent.toFixed(0)}% da renda</span>
                </div>
                <Progress value={clampedPercent} className="h-2" indicatorClassName={status.bg} />
                <p className="text-[10px] text-muted-foreground leading-tight italic">
                    {formatCurrency(committedValue)} já comprometidos (parcelas + estimativas), com base na renda deste mês.
                </p>
            </CardContent>
        </Card>
    );
}
