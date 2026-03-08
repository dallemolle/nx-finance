"use client";

import React, { useState } from "react";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    ChevronLeft,
    ChevronRight,
    Filter,
    Download,
    Plus
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from "recharts";

// Mock data for demonstration
const MOCK_DATA = {
    totalBalance: 12500.50,
    monthlyIncomes: 8400.00,
    monthlyExpenses: 3250.75,
    expensesByCategory: [
        { name: "Moradia", value: 1500, color: "#3b82f6" },
        { name: "Alimentação", value: 800, color: "#10b981" },
        { name: "Transporte", value: 450, color: "#f59e0b" },
        { name: "Lazer", value: 300, color: "#8b5cf6" },
        { name: "Saúde", value: 200, color: "#ef4444" },
    ],
    goals: [
        { category: "Lazer", spent: 300, limit: 500 },
        { category: "Alimentação", spent: 800, limit: 1000 },
    ]
};

export default function DashboardPage() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-screen dark:bg-slate-950">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400">Bem-vindo de volta! Aqui está o resumo das suas finanças.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <button
                        onClick={() => setSelectedMonth(prev => (prev === 0 ? 11 : prev - 1))}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 font-medium min-w-[140px] text-center">
                        {months[selectedMonth]} {selectedYear}
                    </div>
                    <button
                        onClick={() => setSelectedMonth(prev => (prev === 11 ? 0 : prev + 1))}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2" />
                    <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Saldo Total" amount={MOCK_DATA.totalBalance} icon={<Wallet className="text-blue-500" />} />
                <Card title="Receitas do Mês" amount={MOCK_DATA.monthlyIncomes} icon={<ArrowUpCircle className="text-emerald-500" />} trend="+12%" />
                <Card title="Despesas do Mês" amount={MOCK_DATA.monthlyExpenses} icon={<ArrowDownCircle className="text-rose-500" />} trend="-5%" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Card */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold">Gastos por Categoria</h3>
                        <button className="text-sm font-medium text-blue-500 hover:underline flex items-center gap-1">
                            <Download size={14} /> Exportar
                        </button>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={MOCK_DATA.expensesByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {MOCK_DATA.expensesByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Goals System */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">Metas de Gastos</h3>
                    <div className="space-y-6">
                        {MOCK_DATA.goals.map((goal) => {
                            const percentage = (goal.spent / goal.limit) * 100;
                            const isOver = percentage > 90;
                            return (
                                <div key={goal.category} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{goal.category}</span>
                                        <span className="text-slate-500">
                                            R$ {goal.spent} / <span className="font-semibold text-slate-900 dark:text-white">R$ {goal.limit}</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${isOver ? 'bg-rose-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                    {isOver && <p className="text-[10px] text-rose-500 font-medium tracking-tight">Cuidado! Você atingiu {percentage.toFixed(0)}% da sua meta.</p>}
                                </div>
                            );
                        })}
                        <button className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
                            <Plus size={16} /> Nova Meta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Card({ title, amount, icon, trend }: { title: string, amount: number, icon: React.ReactNode, trend?: string }) {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    {icon}
                </div>
                {trend && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <h2 className="text-2xl font-bold">R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        </div>
    );
}
