"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn, maskCurrency } from "@/lib/utils";
import { useIsPrivacyMode } from "./privacy-provider";
import { formatPercentChange, variationTone, type VariationTone } from "@/lib/dashboard-metrics";

interface SummaryCardsProps {
    summary: {
        saldoTotal: number;
        totalEntradas: number;
        totalSaidas: number;
        deltaEntradas: number;
        deltaSaidas: number;
        deltaSaldo: number;
    };
}

const toneClass: Record<VariationTone, string> = {
    good: "text-emerald-600 dark:text-emerald-400",
    bad: "text-rose-600 dark:text-rose-400",
    neutral: "text-muted-foreground",
};

// goodWhen: "up" quando subir é bom (entradas), "down" quando é ruim (saídas).
function Variation({ value, goodWhen }: { value: number; goodWhen: "up" | "down" }) {
    return (
        <div className="flex items-center text-xs font-medium">
            <span className={toneClass[variationTone(value, goodWhen)]}>{formatPercentChange(value)}</span>
            <span className="text-muted-foreground ml-1">vs mês anterior</span>
        </div>
    );
}

const saldoToneClass: Record<VariationTone, string> = {
    good: "bg-emerald-500/10 text-emerald-400",
    bad: "bg-rose-500/10 text-rose-400",
    neutral: "bg-slate-500/10 text-slate-400",
};

export function SummaryCards({ summary }: SummaryCardsProps) {
    const isHidden = useIsPrivacyMode();

    return (
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="relative overflow-hidden border-none shadow-2xl bg-slate-950 text-white">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Wallet className="w-24 h-24" />
                </div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Saldo Disponível</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="text-4xl font-extrabold tracking-tighter">
                        {maskCurrency(summary.saldoTotal, isHidden)}
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge className={cn(
                            "border-none px-2 py-0.5 text-xs font-semibold gap-1",
                            saldoToneClass[variationTone(summary.deltaSaldo, "up")]
                        )}>
                            {summary.deltaSaldo >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : (
                                <TrendingDown className="w-3 h-3" />
                            )}
                            {formatPercentChange(summary.deltaSaldo)}
                        </Badge>
                        <span className="text-[10px] text-slate-400 opacity-60">desde o último mês</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Entradas</CardTitle>
                    <div className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                        <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 italic">
                        {maskCurrency(summary.totalEntradas, isHidden)}
                    </div>
                    <Variation value={summary.deltaEntradas} goodWhen="up" />
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saídas</CardTitle>
                    <div className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/30">
                        <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 italic">
                        {maskCurrency(summary.totalSaidas, isHidden)}
                    </div>
                    <Variation value={summary.deltaSaidas} goodWhen="down" />
                </CardContent>
            </Card>
        </div>
    );
}
