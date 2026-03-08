import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";

export function SummaryCards({ summary }: { summary: any }) {
    return (
        <div className="grid gap-6 md:grid-cols-3">
            <SummaryCard
                title="Saldo Total"
                amount={summary.balance}
                icon={<Wallet className="text-primary" />}
                description="O que você tem hoje"
                className="bg-primary/5 border-primary/10"
            />
            <SummaryCard
                title="Receitas"
                amount={summary.income}
                icon={<ArrowUpCircle className="text-emerald-500" />}
                description="Total do mês"
                className="bg-emerald-50/50 border-emerald-100"
            />
            <SummaryCard
                title="Despesas"
                amount={summary.expenses}
                icon={<ArrowDownCircle className="text-rose-500" />}
                description="Total do mês"
                className="bg-rose-50/50 border-rose-100"
            />
        </div>
    );
}

function SummaryCard({ title, amount, icon, description, className }: any) {
    return (
        <Card className={`border shadow-sm overflow-hidden transition-all hover:shadow-md ${className}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className="p-2 bg-background rounded-lg shadow-sm">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                    R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1 opacity-70">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}
