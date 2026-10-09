import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TopNav } from "@/components/layout/top-nav";
import { getCreditCards, getInvoiceTimelineDetail } from "@/lib/credit-card-provision-actions";
import { InvoiceAnalysisContent } from "./invoice-analysis-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

export default async function FaturasPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        redirect("/auth/login");
    }

    const creditCards = await getCreditCards(session.user.id);
    const groups = creditCards.length > 0 ? await getInvoiceTimelineDetail(session.user.id) : [];

    return (
        <>
            <TopNav />
            <div className="px-8 pb-24 sm:pb-8 pt-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-700">
                <div>
                    <h1 className="text-3xl font-black tracking-tight italic">Faturas</h1>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Análise de faturas futuras por cartão</p>
                </div>

                {creditCards.length === 0 ? (
                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                        <CardContent className="flex flex-col items-center text-center py-16 px-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-6">
                                <CreditCard className="w-8 h-8 text-indigo-500" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight italic text-slate-900 dark:text-slate-100">
                                Nenhum cartão cadastrado
                            </h2>
                            <p className="text-sm text-muted-foreground max-w-md mt-2 mb-8">
                                Cadastre um cartão de crédito em Configurações pra começar a acompanhar compras parceladas e faturas futuras aqui.
                            </p>
                            <Link href="/dashboard/settings">
                                <Button className="h-11">Ir para Configurações</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <InvoiceAnalysisContent groups={groups} />
                )}
            </div>
        </>
    );
}
