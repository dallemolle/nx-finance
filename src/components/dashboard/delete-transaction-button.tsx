"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTransaction } from "@/lib/actions";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

import { unwrap } from "@/lib/action-result";
interface DeleteTransactionButtonProps {
    id: string;
    descricao: string;
    valor: number;
}

// Exclui um lançamento pendente feito em "Nova Transação" (avulso ou uma
// parcela), ex.: lançado em duplicidade (BL-038). Pago não mostra o botão.
export function DeleteTransactionButton({ id, descricao, valor }: DeleteTransactionButtonProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleDelete = () => {
        if (!confirm(`Excluir o lançamento "${descricao}" (${formatCurrency(valor)})?\n\nEssa ação não pode ser desfeita.`)) return;
        startTransition(async () => {
            try {
                await deleteTransaction(id).then(unwrap);
                toast.success("Lançamento excluído.");
                router.refresh();
            } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Erro ao excluir o lançamento"));
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:h-8 md:w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            onClick={handleDelete}
            disabled={isPending}
            title="Excluir lançamento"
            aria-label={`Excluir lançamento ${descricao}`}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );
}
