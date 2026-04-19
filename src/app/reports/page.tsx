import { getReportData, getCategories, getFinancialInstitutions, getPaymentMethods } from "@/lib/reports";
import { MonthPicker } from "@/components/dashboard/month-picker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { ReportContent } from "./report-content";

interface ReportsPageProps {
    searchParams: Promise<{
        month?: string;
        year?: string;
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
    } = await searchParams;

    const now = new Date();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    // Buscamos todas as transações do mês e os dados auxiliares
    const [allTransactions, categories, institutions, paymentMethods] = await Promise.all([
        getReportData(session.user.id, month, year),
        getCategories(session.user.id),
        getFinancialInstitutions(session.user.id),
        getPaymentMethods(session.user.id)
    ]);

    return (
        <>
            <TopNav />
            <div className="px-8 pb-8 pt-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight italic">Relatórios</h1>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Análise detalhada do seu fluxo mensal</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <MonthPicker
                            month={month}
                            year={year}
                        />
                    </div>
                </div>

                <ReportContent 
                    transactions={allTransactions}
                    categories={categories}
                    institutions={institutions}
                    paymentMethods={paymentMethods}
                />
            </div>
        </>
    );
}