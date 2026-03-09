"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HeartPulse } from "lucide-react";

interface FinancialHealthProps {
    score: number;
}

export function FinancialHealth({ score }: FinancialHealthProps) {
    // Score is % of income spent. 0 = perfect, >100 = critical
    const clampedScore = Math.min(score, 100);
    const getStatus = () => {
        if (score < 50) return { label: "Excelente", color: "text-emerald-500", bg: "bg-emerald-500" };
        if (score < 80) return { label: "Boa", color: "text-blue-500", bg: "bg-blue-500" };
        if (score < 100) return { label: "Alerta", color: "text-orange-500", bg: "bg-orange-500" };
        return { label: "Crítica", color: "text-rose-500", bg: "bg-rose-500" };
    };

    const status = getStatus();

    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saúde Financeira</CardTitle>
                <HeartPulse className={`w-4 h-4 ${status.color}`} />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className={`text-xl font-black ${status.color}`}>{status.label}</span>
                    <span className="text-sm font-medium text-muted-foreground">{score.toFixed(0)}% da receita gasta</span>
                </div>
                <Progress value={clampedScore} className="h-2" indicatorClassName={status.bg} />
                <p className="text-[10px] text-muted-foreground leading-tight italic">
                    {score < 100 ? "Você está dentro do seu orçamento planejado." : "Atenção: seus gastos superaram sua receita este mês."}
                </p>
            </CardContent>
        </Card>
    );
}
