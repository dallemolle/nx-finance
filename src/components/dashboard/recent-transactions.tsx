import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditTransactionDialog } from "./edit-transaction-dialog";

interface Transaction {
    id: string;
    descricao: string;
    valor: any;
    data_vencimento: Date;
    status: string;
    tipo: string;
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
                return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Pago</Badge>;
            case "ATRASADO":
                return <Badge variant="destructive" className="animate-pulse">Atrasado</Badge>;
            default:
                return <Badge variant="secondary">Pendente</Badge>;
        }
    };

    return (
        <Card className="col-span-1 border-none shadow-lg md:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Últimas Transações</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 transition-colors rounded-lg hover:bg-muted/50">
                            <div className="flex flex-col">
                                <span className="font-medium">{t.descricao}</span>
                                <span className="text-xs text-muted-foreground">
                                    {format(new Date(t.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className={`font-bold ${t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(Number(t.valor))}
                                    </p>
                                    {getStatusBadge(t.status)}
                                </div>
                                <EditTransactionDialog transaction={t} userId={userId} />
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground italic">
                            Nenhuma transação recente.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
