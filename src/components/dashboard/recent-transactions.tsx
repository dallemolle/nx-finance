"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { QuickPayButton } from "./quick-pay-button";
import { ChevronRight, ChevronDown, CreditCard } from "lucide-react";
import type { TransactionDisplay, InvoiceItemDisplay } from "@/types/models";

interface RecentTransactionsProps {
    transactions: TransactionDisplay[];
    userId: string;
}

export function RecentTransactions({ transactions, userId }: RecentTransactionsProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAGO":
                return <Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Efetivado</Badge>;
            case "ATRASADO":
                return <Badge className="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Pendente</Badge>;
            default:
                return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Agendado</Badge>;
        }
    };

    // Filtra itens avulsos de fatura (serão exibidos dentro do expand dos pais)
    const entradas = transactions.filter(t => t.tipo === "ENTRADA" && !t.isInvoiceItem);
    const saidas = transactions.filter(t => t.tipo === "SAIDA" && !t.isInvoiceItem);

    const renderTransactionList = (list: TransactionDisplay[], emptyMessage: string, tipo: string) => {
        if (list.length === 0) {
            return (
                <div className="py-6 text-center text-muted-foreground italic text-xs">
                    {emptyMessage}
                </div>
            );
        }

        const rows: ReactNode[] = [];

        list.forEach((t) => {
            const isExpanded = expandedRows.has(t.id);
                            const hasInvoiceItems = t.is_invoice_header === true && Array.isArray(t.invoiceItems) && t.invoiceItems.length > 0;

            rows.push(
                <div key={t.id} className="group flex items-center justify-between py-1.5 px-2 transition-all rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-1 h-10 rounded-full ${tipo === 'ENTRADA' ? 'bg-emerald-500' : 'bg-rose-500'} opacity-20 group-hover:opacity-100 transition-opacity shrink-0`} />
                        <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm leading-tight capitalize flex items-center gap-1.5">
                                {hasInvoiceItems && (
                                    <button
                                        onClick={() => toggleExpand(t.id)}
                                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors shrink-0"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                    </button>
                                )}
                                {t.is_invoice_header && (
                                    <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                )}
                                <span className="truncate">{t.descricao}</span>
                            </span>
                            {t.institution && (
                                <div className="flex items-center gap-1 mt-0.5 ml-1">
                                    {t.institution.cor && (
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.institution.cor }} />
                                    )}
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                        {t.institution.nome}
                                    </span>
                                </div>
                            )}
                            <span className="text-[11px] text-muted-foreground font-medium mt-0.5 ml-1">
                                {format(new Date(t.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-3 shrink-0">
                        <div className="text-right min-w-[80px] md:min-w-[100px]">
                            <p className={`text-sm font-black tracking-tight ${tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(Number(t.valor))}
                            </p>
                            {getStatusBadge(t.status)}
                        </div>
                        <div className="flex items-center">
                            {t.status !== "PAGO" && <QuickPayButton transactionId={t.id} />}
                            <EditTransactionDialog transaction={t} userId={userId} />
                        </div>
                    </div>
                </div>
            );

            // Sub-itens expandidos
            if (isExpanded && hasInvoiceItems && t.invoiceItems) {
                t.invoiceItems.forEach((item: InvoiceItemDisplay, idx: number) => {
                    rows.push(
                        <div key={`${t.id}-item-${idx}`} className="flex items-center justify-between py-1.5 pl-10 pr-2 transition-all rounded-lg bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.descricao}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category?.cor || "#94a3b8" }} />
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                            {item.category?.nome || "Sem categoria"}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                        {format(new Date(item.data_vencimento || item.data_compra), "dd 'de' MMMM", { locale: ptBR })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-3 shrink-0">
                                <div className="text-right min-w-[80px] md:min-w-[100px]">
                                    <p className={`text-xs font-semibold tracking-tight ${Number(item.valor) < 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                        {Number(item.valor) < 0 ? "+" : "-"} {formatCurrency(Math.abs(Number(item.valor)))}
                                    </p>
                                </div>
                                <div className="w-[72px]" />
                            </div>
                        </div>
                    );
                });
            }
        });

        return rows;
    };

    return (
        <Card className="col-span-1 border-none shadow-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 md:col-span-2 flex flex-col h-[520px] max-h-[520px]">
            <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 tracking-tight">Lançamentos do Mês</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden pb-4">
                <div className="space-y-4 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <h3 className="text-[10px] uppercase font-black text-emerald-600 tracking-[0.2em] bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">Entradas / Receitas</h3>
                             <div className="h-[1px] flex-1 bg-emerald-100 dark:bg-emerald-900/30" />
                        </div>
                        {renderTransactionList(entradas, "Nenhuma receita este mês.", "ENTRADA")}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <h3 className="text-[10px] uppercase font-black text-rose-600 tracking-[0.2em] bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded">Saídas / Despesas</h3>
                             <div className="h-[1px] flex-1 bg-rose-100 dark:bg-rose-900/30" />
                        </div>
                        {renderTransactionList(saidas, "Nenhuma despesa este mês.", "SAIDA")}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
