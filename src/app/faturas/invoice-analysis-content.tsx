"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StackedInvoiceBarChart } from "@/components/dashboard/stacked-invoice-bar-chart";
import { ProvisionedBadge } from "@/components/dashboard/provisioned-badge";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import type { getInvoiceTimelineDetail } from "@/lib/credit-card-provision-actions";

type InvoiceTimelineGroups = Awaited<ReturnType<typeof getInvoiceTimelineDetail>>;

interface InvoiceAnalysisContentProps {
    groups: InvoiceTimelineGroups;
}

export function InvoiceAnalysisContent({ groups }: InvoiceAnalysisContentProps) {
    // Guarda só as chaves FECHADAS — vazio significa "tudo aberto", o padrão pedido.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const toggle = (key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {groups.map(group => (
                <Card key={group.cardId} className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.cardCor || "#6366f1" }} />
                        <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 tracking-tight">{group.cardNome}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <StackedInvoiceBarChart data={group.months} height={180} />

                        <div className="space-y-3">
                            {group.months.map(month => {
                                const key = `${group.cardId}-${month.year}-${month.month}`;
                                const isOpen = !collapsed.has(key);
                                return (
                                    <div key={key} className="border border-slate-100 dark:border-slate-800/50 rounded-xl overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => toggle(key)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isOpen ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                )}
                                                <span className="text-sm font-bold capitalize text-slate-700 dark:text-slate-300">{month.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs font-semibold">
                                                {month.confirmed > 0 && (
                                                    <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(month.confirmed)} confirmado</span>
                                                )}
                                                {month.provisioned > 0 && (
                                                    <span className="text-amber-600 dark:text-amber-400">{formatCurrency(month.provisioned)} previsto</span>
                                                )}
                                                <span className="text-slate-900 dark:text-slate-100">{formatCurrency(month.total)}</span>
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="p-2 space-y-2 bg-white dark:bg-slate-900">
                                                {month.items.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic text-center py-4">Nenhuma despesa neste mês.</p>
                                                ) : (
                                                    month.items.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/50"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center shrink-0">
                                                                    <ScrollText className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 truncate">
                                                                        {item.descricao}
                                                                        {item.is_provisioned && <ProvisionedBadge />}
                                                                    </span>
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                                        {item.category && (
                                                                            <span className="flex items-center gap-1 shrink-0">
                                                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category.cor }} />
                                                                                {item.category.nome}
                                                                            </span>
                                                                        )}
                                                                        <span className="shrink-0">{format(new Date(item.data_compra), "dd 'de' MMM", { locale: ptBR })}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-2">
                                                                {formatCurrency(item.valor)}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
