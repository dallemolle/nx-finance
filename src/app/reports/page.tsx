import { getReportData, getCategories } from "@/lib/reports";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportFilters } from "./report-filters";
import { TopNav } from "@/components/layout/top-nav";

interface ReportsPageProps {
    searchParams: Promise<{
        month?: string;
        year?: string;
        status?: string;
        category?: string;
    }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        redirect("/auth/login");
    }

    const {
        month: monthParam,
        year: yearParam,
        status: statusFilter = "ALL",
        category: categoryFilter = "ALL"
    } = await searchParams;

    const now = new Date();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    const [data, categories] = await Promise.all([
        getReportData(session.user.id, month, year, {
            status: statusFilter,
            categoria_id: categoryFilter
        }),
        getCategories(session.user.id)
    ]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAGO": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-none">Pago</Badge>;
            case "ATRASADO": return <Badge variant="destructive">Atrasado</Badge>;
            default: return <Badge variant="secondary">Pendente</Badge>;
        }
    };

    return (
        <>
            <TopNav />
            <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h1 className="text-3xl font-black tracking-tight italic">Relatórios</h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <MonthPicker
                            month={month}
                            year={year}
                        />
                        <ReportFilters
                            statusFilter={statusFilter}
                            categoryFilter={categoryFilter}
                            categories={categories}
                        />
                    </div>
                </div>

                <div className="border rounded-xl shadow-sm overflow-hidden bg-card ring-1 ring-slate-200 dark:ring-slate-800">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-bold">Descrição</TableHead>
                                <TableHead className="font-bold">Categoria</TableHead>
                                <TableHead className="font-bold">Data</TableHead>
                                <TableHead className="font-bold">Valor</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((t) => (
                                <TableRow key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <TableCell className="font-medium capitalize">{t.descricao}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.category.cor }} />
                                            <span className="text-sm font-medium">{t.category.nome}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{t.displayDate}</TableCell>
                                    <TableCell className={`text-sm font-black tracking-tight ${t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
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
        </>
    );
}
