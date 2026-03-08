"use client";

import { useState, useEffect } from "react";
import { SummaryCards } from "../components/dashboard/summary-cards";
import { CategoryChart } from "../components/dashboard/category-chart";
import { RecentTransactions } from "../components/dashboard/recent-transactions";
import { MonthPicker } from "../components/dashboard/month-picker";
import { getDashboardData } from "@/lib/dashboard";
import { useSession } from "next-auth/react";
import { Skeleton } from "../components/ui/skeleton";
import { NewTransactionDialog } from "../components/dashboard/new-transaction-dialog";

export default function DashboardPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        async function fetchData() {
            if (!session?.user?.id) return;
            setLoading(true);
            try {
                const result = await getDashboardData(session.user.id, month, year);
                setData(result);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [session, month, year]);

    if (!session?.user) return null;

    if (loading || !data) {
        return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <Skeleton className="w-[200px] h-8" />
                    <Skeleton className="w-[250px] h-10" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="col-span-1 h-[400px]" />
                    <Skeleton className="col-span-2 h-[400px]" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Bem-vindo de volta ao seu controle financeiro.</p>
                </div>
                <div className="flex items-center gap-4">
                    <NewTransactionDialog userId={session.user.id} />
                    <MonthPicker
                        month={month}
                        year={year}
                        onMonthChange={setMonth}
                        onYearChange={setYear}
                    />
                </div>
            </div>

            <SummaryCards summary={data.summary} />

            <div className="grid gap-6 md:grid-cols-3">
                <CategoryChart data={data.categoryData} />
                <RecentTransactions transactions={data.latestTransactions} userId={session.user.id} />
            </div>
        </div>
    );
}
