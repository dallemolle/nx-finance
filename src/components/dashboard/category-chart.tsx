"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ScrollText, ArrowDownRight, Tag, Building2, Banknote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryGroupName } from "@/lib/dashboard-utils";

interface CategoryChartProps {
    data: {
        name: string;
        value: number;
        fill: string;
    }[];
    transactions?: any[];
}

export function CategoryChart({ data, transactions = [] }: CategoryChartProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const total = sortedData.reduce((acc, curr) => acc + curr.value, 0);
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    return (
        <Card className={cn("col-span-1 border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 flex flex-col", !isExpanded ? "h-[520px] max-h-[520px]" : "h-auto")}>
            <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-slate-300">Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden pb-4">
                {data.length > 0 ? (
                    <div className="flex flex-col h-full">
                        {/* CHART SIDE */}
                        <div className="w-full shrink-0 h-[220px] relative mb-4">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">{formatCurrency(total)}</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sortedData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={95}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                        onMouseEnter={(_, index) => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                    >
                                        {sortedData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.fill}
                                                className="transition-all duration-300 outline-none"
                                                opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                                                style={{ filter: activeIndex === index ? 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))' : 'none' }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            backdropFilter: 'blur(4px)'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* LEGEND SIDE */}
                        <div className="w-full flex flex-col flex-1 min-h-0">
                            <div className={cn(
                                "flex flex-col space-y-1 w-full flex-1 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800",
                                !isExpanded ? "overflow-y-auto max-h-[140px]" : "overflow-visible h-auto"
                            )}>
                                {sortedData.map((item, index) => (
                                    <div
                                        key={item.name}
                                        className={cn(
                                            "flex items-center justify-between py-3 px-2 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-none",
                                            activeIndex === index
                                                ? "bg-slate-50 dark:bg-slate-800/80 rounded-md shadow-sm"
                                                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-sm"
                                        )}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                        onClick={() => setSelectedCategory(item.name)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: item.fill, opacity: activeIndex === null || activeIndex === index ? 1 : 0.4 }}
                                            />
                                            <span className={cn(
                                                "text-sm tracking-tight capitalize",
                                                activeIndex === index ? "font-bold text-slate-900 dark:text-slate-100" : "font-normal text-slate-700 dark:text-slate-300"
                                            )}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-right">
                                            <span className={cn(
                                                "text-sm tracking-tight",
                                                activeIndex === index ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"
                                            )}>
                                                {formatCurrency(item.value)}
                                            </span>
                                            <span className={cn(
                                                "text-sm w-12 text-right font-medium",
                                                activeIndex === index ? "text-slate-600 dark:text-slate-400" : "text-muted-foreground"
                                            )}>
                                                ({Math.round((item.value / total) * 100)}%)
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {sortedData.length > 5 && (
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                >
                                    {isExpanded ? (
                                        <>
                                            Recolher
                                            <ChevronUp className="w-4 h-4" />
                                        </>
                                    ) : (
                                        <>
                                            Ver Tudo
                                            <ChevronDown className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-[300px] w-full items-center justify-center text-muted-foreground italic">
                        Nenhuma despesa este mês.
                    </div>
                )}
            </CardContent>

            <Dialog open={selectedCategory !== null} onOpenChange={(open) => !open && setSelectedCategory(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col sm:rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-0 overflow-hidden">
                    {selectedCategory && (() => {
                        const categoryItem = sortedData.find(c => c.name === selectedCategory);
                        const categoryTransactions = transactions.filter(t => 
                            t.tipo === "SAIDA" && getCategoryGroupName(t.category?.nome || "") === selectedCategory
                        );
                        
                        return (
                            <>
                                <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner"
                                            style={{ backgroundColor: `${categoryItem?.fill}20`, color: categoryItem?.fill }}
                                        >
                                            <Tag className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                                                {selectedCategory}
                                            </DialogTitle>
                                            <DialogDescription className="text-sm font-medium">
                                                Total no período: <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(categoryItem?.value || 0)}</span> ({categoryTransactions.length} transações)
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>
                                
                                <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 p-2 sm:p-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                                    <div className="space-y-2">
                                        {categoryTransactions.length > 0 ? (
                                            categoryTransactions.map((t) => (
                                                <div 
                                                    key={t.id} 
                                                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                            <ArrowDownRight className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base line-clamp-1">{t.descricao}</span>
                                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                                <span className="flex items-center gap-1">
                                                                    <ScrollText className="w-3 h-3" />
                                                                    {format(new Date(t.data_vencimento), "dd 'de' MMM", { locale: ptBR })}
                                                                </span>
                                                                <span className="hidden sm:flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" />
                                                                    {t.institution?.nome || "Cartão"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                                                        <Banknote className="w-4 h-4 text-rose-500" />
                                                        <span className="font-bold text-rose-600 dark:text-rose-400">
                                                            {formatCurrency(Number(t.valor))}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                                    <ScrollText className="w-8 h-8 text-slate-400" />
                                                </div>
                                                <p className="text-slate-500 font-medium">Nenhuma transação encontrada</p>
                                                <p className="text-sm text-slate-400 mt-1">Os dados podem estar agrupados temporariamente.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
