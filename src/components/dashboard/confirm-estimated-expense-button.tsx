"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { confirmEstimatedExpense } from "@/lib/credit-card-provision-actions";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import type { TransactionDisplay } from "@/types/models";

interface ConfirmEstimatedExpenseButtonProps {
    transaction: TransactionDisplay;
}

export function ConfirmEstimatedExpenseButton({ transaction }: ConfirmEstimatedExpenseButtonProps) {
    const [open, setOpen] = useState(false);
    const [valor, setValor] = useState(String(transaction.valor));
    const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date(transaction.data_vencimento));
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleConfirm = () => {
        const parsed = parseFloat(valor);
        if (isNaN(parsed) || parsed <= 0) {
            toast.error("Informe um valor válido");
            return;
        }
        if (!dataVencimento) {
            toast.error("Informe uma data de vencimento válida");
            return;
        }
        startTransition(async () => {
            try {
                await confirmEstimatedExpense(transaction.id, { valor: parsed, data_vencimento: dataVencimento });
                toast.success("Despesa efetivada!");
                setOpen(false);
                router.refresh();
            } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Erro ao efetivar despesa"));
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                onClick={() => { setValor(String(transaction.valor)); setDataVencimento(new Date(transaction.data_vencimento)); setOpen(true); }}
                title="Efetivar como despesa real"
            >
                <BadgeCheck className="h-4 w-4" />
            </Button>
            <DialogContent className="sm:max-w-[380px]">
                <DialogHeader>
                    <DialogTitle>Efetivar Despesa Prevista</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="valor-efetivar">Valor real (R$)</Label>
                        <Input
                            id="valor-efetivar"
                            type="number"
                            step="0.01"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Data de vencimento</Label>
                        <DatePicker date={dataVencimento} setDate={setDataVencimento} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Confirme ou ajuste o valor e a data. O lançamento deixa de ser &quot;previsto&quot; e passa a contar como despesa real do mês.
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Efetivar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
