import { Wallet, Upload, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NewTransactionDialog } from "@/components/dashboard/new-transaction-dialog";
import { CsvImportDialog } from "@/components/dashboard/csv-import-dialog";
import { CreditCardInvoiceDialog } from "@/components/dashboard/credit-card-invoice-dialog";

export function EmptyDashboardState({ userId }: { userId: string }) {
    return (
        <Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
            <CardContent className="flex flex-col items-center text-center py-16 px-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-6">
                    <Wallet className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-black tracking-tight italic text-slate-900 dark:text-slate-100">
                    Bem-vindo ao seu centro financeiro
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mt-2 mb-8">
                    Você ainda não tem nenhuma transação cadastrada. Comece adicionando um lançamento manualmente ou importando seus dados existentes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
                    <NewTransactionDialog userId={userId} className="w-full h-11" />
                    <CsvImportDialog userId={userId} className="w-full h-11" />
                    <CreditCardInvoiceDialog userId={userId} className="w-full h-11" />
                </div>
                <div className="flex items-center gap-6 mt-8 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Importe um extrato CSV
                    </span>
                    <span className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        Ou uma fatura de cartão
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
