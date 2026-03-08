"use client";

import { useState, useEffect } from "react";
import { getReportData, getCategories } from "@/lib/reports";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { useSession } from "next-auth/react";

export default function ReportsPage() {
    const { data: session } = useSession();
    const [data, setData] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");

    useEffect(() => {
        async function loadData() {
            if (!session?.user?.id) return;
            const [transactions, cats] = await Promise.all([
                getReportData(session.user.id, month, year, {
                    status: statusFilter,
                    categoria_id: categoryFilter
                }),
                getCategories(session.user.id)
            ]);
            setData(transactions);
            setCategories(cats);
        }
        loadData();
    }, [session, month, year, statusFilter, categoryFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAGO": return <Badge className="bg-emerald-100 text-emerald-700 border-none">Pago</Badge>;
            case "ATRASADO": return <Badge variant="destructive">Atrasado</Badge>;
            default: return <Badge variant="secondary">Pendente</Badge>;
        }
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
                <div className="flex flex-wrap items-center gap-3">
                    <MonthPicker
                        month={month}
                        year={year}
                        onMonthChange={setMonth}
                        onYearChange={setYear}
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todo Status</SelectItem>
                            <SelectItem value="PAGO">Pago</SelectItem>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                            <SelectItem value="ATRASADO">Atrasado</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas Categorias</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-xl shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell className="font-medium">{t.descricao}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.category.cor }} />
                                        {t.category.nome}
                                    </div>
                                </TableCell>
                                <TableCell>{t.displayDate}</TableCell>
                                <TableCell className={t.tipo === 'ENTRADA' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                                    {t.tipo === 'ENTRADA' ? '+' : '-'} {t.formattedAmount}
                                </TableCell>
                                <TableCell>{getStatusBadge(t.status)}</TableCell>
                            </TableRow>
                        ))}
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                                    Nenhuma transação encontrada para os filtros selecionados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
