"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CategoryChartProps {
    data: {
        name: string;
        value: number;
        fill: string;
    }[];
}

export function CategoryChart({ data }: CategoryChartProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const total = sortedData.reduce((acc, curr) => acc + curr.value, 0);
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    return (
        <Card className="col-span-1 border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 flex flex-col h-[520px] max-h-[520px]">
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
                                "flex flex-col space-y-1 w-full flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800",
                                !isExpanded ? "max-h-[140px]" : "max-h-full"
                            )}>
                                {sortedData.map((item, index) => (
                                    <div
                                        key={item.name}
                                        className={cn(
                                            "flex items-center justify-between py-3 px-2 transition-colors cursor-default border-b border-slate-100 dark:border-slate-800/50 last:border-none",
                                            activeIndex === index
                                                ? "bg-slate-50 dark:bg-slate-800/80 rounded-md shadow-sm"
                                                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-sm"
                                        )}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
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
        </Card>
    );
}
