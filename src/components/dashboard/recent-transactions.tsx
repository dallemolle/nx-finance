import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { QuickPayButton } from "./quick-pay-button";

interface Transaction {
    id: string;
    descricao: string;
    valor: any;
    data_vencimento: Date;
    status: string;
    tipo: string;
    institution?: { id: string; nome: string; cor: string | null };
}

interface RecentTransactionsProps {
    transactions: Transaction[];
    userId: string;
}

export function RecentTransactions({ transactions, userId }: RecentTransactionsProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAGO":
                return <Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Efetivado</Badge>;
            case "ATRASADO":
                return <Badge className="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Pendente</Badge>;
            default:
                return <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">Agendado</Badge>;
        }
    };

    return (
        <Card className="col-span-1 border-none shadow-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 md:col-span-2 flex flex-col h-[520px] max-h-[520px]">
            <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 tracking-tight">Lançamentos do Mês</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden pb-4">
                <div className="space-y-0.5 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {transactions.map((t) => (
                        <div key={t.id} className="group flex items-center justify-between py-1.5 px-2 transition-all rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-1 h-10 rounded-full ${t.tipo === 'ENTRADA' ? 'bg-emerald-500' : 'bg-rose-500'} opacity-20 group-hover:opacity-100 transition-opacity`} />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm leading-tight capitalize">{t.descricao}</span>
                                    {t.institution && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            {t.institution.cor && (
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.institution.cor }} />
                                            )}
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                                {t.institution.nome}
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                        {format(new Date(t.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-3">
                                <div className="text-right min-w-[80px] md:min-w-[100px]">
                                    <p className={`text-sm font-black tracking-tight ${t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(Number(t.valor))}
                                    </p>
                                    {getStatusBadge(t.status)}
                                </div>
                                <div className="flex items-center">
                                    {t.status !== "PAGO" && <QuickPayButton transactionId={t.id} />}
                                    <EditTransactionDialog transaction={t} userId={userId} />
                                </div>
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground italic text-sm">
                            Nenhum lançamento encontrado para este período.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
