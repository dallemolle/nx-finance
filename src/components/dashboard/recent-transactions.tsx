"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { Badge } from "@/components/ui/badge";

export function RecentTransactions({ transactions, userId }: { transactions: any[], userId: string }) {
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PAGO": return "bg-emerald-100 text-emerald-700 border-none px-3";
            case "PENDENTE": return "bg-amber-100 text-amber-700 border-none px-3";
            case "ATRASADO": return "bg-rose-100 text-rose-700 border-none px-3";
            default: return "";
        }
    };

    return (
        <Card className="col-span-2 border-none shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-muted/20">
                <CardTitle className="text-lg font-semibold">Últimos Lançamentos</CardTitle>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" asChild>
                    <a href="/reports">
                        Ver tudo <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-2 h-10 rounded-full"
                                    style={{ backgroundColor: t.category.cor }}
                                />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold leading-none">{t.descricao}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(t.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className={`text-sm font-bold ${t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.tipo === 'ENTRADA' ? '+' : '-'} R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <Badge className={`${getStatusColor(t.status)} text-[10px] uppercase font-bold`}>
                                        {t.status}
                                    </Badge>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                    onClick={() => setSelectedTransaction(t)}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground italic">
                            Nenhuma transação encontrada.
                        </div>
                    )}
                </div>
            </CardContent>

            {selectedTransaction && (
                <EditTransactionDialog
                    transaction={selectedTransaction}
                    open={!!selectedTransaction}
                    onOpenChange={(open) => !open && setSelectedTransaction(null)}
                    userId={userId}
                />
            )}
        </Card>
    );
}
