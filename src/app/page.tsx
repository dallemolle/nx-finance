import { SummaryCards } from "../components/dashboard/summary-cards";
import { CategoryChart } from "../components/dashboard/category-chart";
import { RecentTransactions } from "../components/dashboard/recent-transactions";
import { MonthPicker } from "../components/dashboard/month-picker";
import { getDashboardData } from "@/lib/dashboard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewTransactionDialog } from "../components/dashboard/new-transaction-dialog";
import { FinancialHealth } from "../components/dashboard/financial-health";
import { Forecast } from "../components/dashboard/forecast";
import { ExportButtons } from "../components/dashboard/export-buttons";
import { ThemeToggle } from "../components/theme-toggle";
import { TopNav } from "@/components/layout/top-nav";

interface DashboardPageProps {
    searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect("/auth/login");
    }

    const { month: monthParam, year: yearParam } = await searchParams;
    const now = new Date();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    const data = await getDashboardData(session.user.id, month, year);

    return (
        <>
            <TopNav />
            <div className="px-8 pb-8 pt-1 space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-100 italic">Dashboard</h1>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Bem-vindo ao seu centro financeiro premium.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <ExportButtons />
                        <NewTransactionDialog userId={session.user.id} />
                        <MonthPicker
                            month={month}
                            year={year}
                        />
                    </div>
                </div>

                <SummaryCards summary={data.summary} />

                <div className="grid gap-6 md:grid-cols-3">
                    <CategoryChart data={data.categoryData} />
                    <div className="col-span-1 md:col-span-2">
                        <RecentTransactions transactions={data.monthlyTransactions} userId={session.user.id} />
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <FinancialHealth score={data.metrics.healthScore} />
                    <Forecast
                        forecast={data.metrics.forecast}
                        daysPassed={data.metrics.daysPassed}
                        totalDays={data.metrics.totalDays}
                    />
                </div>
            </div>
        </>
    );
}
