"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportFilters } from "./report-filters";
import { ChevronRight, ChevronDown, ChevronLeft, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransactionDisplay, InvoiceItemDisplay, Category, PaymentMethod, FinancialInstitution } from "@/types/models";

const PAGE_SIZE = 50;

interface ReportContentProps {
    transactions: TransactionDisplay[];
    categories: Category[];
    institutions: FinancialInstitution[];
    paymentMethods: PaymentMethod[];
}

export function ReportContent({ transactions, categories, institutions, paymentMethods }: ReportContentProps) {
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [institutionFilter, setInstitutionFilter] = useState("ALL");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("ALL");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const filterKey = `${statusFilter}|${categoryFilter}|${institutionFilter}|${paymentMethodFilter}`;
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (filterKey !== prevFilterKey) {
        setPrevFilterKey(filterKey);
        setCurrentPage(1);
    }

    const toggleExpand = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Filtragem Instantânea
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
            const matchesCategory = categoryFilter === "ALL" || t.categoria_id === categoryFilter;
            const matchesInstitution = institutionFilter === "ALL" || t.institution_id === institutionFilter;
            const matchesPaymentMethod = paymentMethodFilter === "ALL" || t.tipo_pagamento_id === paymentMethodFilter;
            return matchesStatus && matchesCategory && matchesInstitution && matchesPaymentMethod;
        });
    }, [transactions, statusFilter, categoryFilter, institutionFilter, paymentMethodFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredTransactions.slice(start, start + PAGE_SIZE);
    }, [filteredTransactions, currentPage]);

    // Cálculo dos Totais por Meio de Pagamento (para o Dropdown)
    // Reflete o somatório total de cada método dentro deste mês
    const paymentMethodTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        transactions.forEach(t => {
            if (t.tipo_pagamento_id) {
                const val = t.tipo === 'SAIDA' ? -Number(t.valor) : Number(t.valor);
                totals[t.tipo_pagamento_id] = (totals[t.tipo_pagamento_id] || 0) + val;
            }
        });
        return totals;
    }, [transactions]);

    // Totais Gerais (para o rodapé)
    const summaryTotals = useMemo(() => {
        return filteredTransactions.reduce(
            (acc, t) => {
                const val = t.tipo === 'SAIDA' ? -Number(t.valor) : Number(t.valor);
                if (t.status === 'PAGO') acc.PAGO += val;
                else if (t.status === 'ATRASADO') acc.ATRASADO += val;
                else if (t.status === 'PENDENTE') acc.PENDENTE += val;
                
                if (t.status === 'PENDENTE' || t.status === 'ATRASADO') acc.PENDENCIAS += val;
                return acc;
            },
            { PAGO: 0, PENDENTE: 0, ATRASADO: 0, PENDENCIAS: 0 }
        );
    }, [filteredTransactions]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAGO": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-none">Pago</Badge>;
            case "ATRASADO": return <Badge variant="destructive">Atrasado</Badge>;
            default: return <Badge variant="secondary">Pendente</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <ReportFilters
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    institutionFilter={institutionFilter}
                    onInstitutionChange={setInstitutionFilter}
                    paymentMethodFilter={paymentMethodFilter}
                    onPaymentMethodChange={setPaymentMethodFilter}
                    categories={categories}
                    institutions={institutions}
                    paymentMethods={paymentMethods}
                    paymentMethodTotals={paymentMethodTotals}
                />
            </div>

            <div className="border rounded-xl shadow-sm overflow-hidden bg-card ring-1 ring-slate-200 dark:ring-slate-800">
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="font-bold">Descrição</TableHead>
                            <TableHead className="font-bold">Instituição</TableHead>
                            <TableHead className="font-bold">Meio</TableHead>
                            <TableHead className="font-bold">Categoria</TableHead>
                            <TableHead className="font-bold">Data</TableHead>
                            <TableHead className="font-bold">Valor</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">
                                    Nenhuma transação encontrada para os filtros selecionados.
                                </TableCell>
                            </TableRow>
                        ) : paginatedTransactions.flatMap((t) => {
                            const isExpanded = expandedRows.has(t.id);
                            const hasInvoiceItems = t.is_invoice_header && (t.invoiceItems?.length ?? 0) > 0;

                            // Filtra subitens pela categoria selecionada
                            const filteredItems = hasInvoiceItems && categoryFilter !== "ALL"
                                ? (t.invoiceItems || []).filter((item: InvoiceItemDisplay) => item.categoria_id === categoryFilter)
                                : t.invoiceItems || [];

                            const rows: ReactNode[] = [];

                            // Main row
                            rows.push(
                                <TableRow key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <TableCell className="font-medium capitalize">
                                        <div className="flex items-center gap-2">
                                            {hasInvoiceItems && (
                                                <button
                                                    onClick={() => toggleExpand(t.id)}
                                                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            )}
                                            {t.is_invoice_header && (
                                                <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />
                                            )}
                                            {t.descricao}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {t.institution ? (
                                            <div className="flex items-center gap-2">
                                                {t.institution.cor && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.institution.cor }} />}
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t.institution.nome}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium text-muted-foreground">{t.paymentMethod?.nome || "-"}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.category.cor }} />
                                            <span className="text-sm font-medium">{t.category.nome}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{t.displayDate}</TableCell>
                                    <TableCell className={`text-sm font-black tracking-tight ${t.tipo === 'ENTRADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {t.tipo === 'ENTRADA' ? '+' : '-'} {t.formattedAmount}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                                </TableRow>
                            );

                            // Sub-rows (diretamente abaixo da linha principal)
                            if (isExpanded && filteredItems.length > 0) {
                                filteredItems.forEach((item: InvoiceItemDisplay, idx: number) => {
                                    rows.push(
                                        <TableRow key={`${t.id}-item-${idx}`} className="bg-slate-50/50 dark:bg-slate-900/50 text-sm">
                                            <TableCell className="pl-10">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                    <span className="text-slate-600 dark:text-slate-400">{item.descricao}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell colSpan={2}>
                                                <span className="text-xs italic text-muted-foreground">Item de fatura</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category.cor }} />
                                                    <span className="text-xs font-medium text-muted-foreground">{item.category.nome}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.displayDate}</TableCell>
                                            <TableCell className={cn(
                                                "text-xs font-semibold",
                                                item.valor < 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                                            )}>
                                                {item.valor < 0 ? "+" : "-"} {formatCurrency(Math.abs(item.valor))}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    );
                                });
                            }

                            return rows;
                        })}
                    </TableBody>
                </Table>
                </div>
            </div>

            {filteredTransactions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
                    <span className="text-muted-foreground">
                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}
                        –{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} de {filteredTransactions.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-muted-foreground font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-bold tracking-tight">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Total Pago: {formatCurrency(summaryTotals.PAGO)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        Total Pendente: {formatCurrency(summaryTotals.PENDENTE)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Total Atrasado: {formatCurrency(summaryTotals.ATRASADO)}
                    </span>
                    <span className="text-orange-600 dark:text-orange-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Total Pendências: {formatCurrency(summaryTotals.PENDENCIAS)}
                    </span>
                </div>
            </div>
        </div>
    );
}
