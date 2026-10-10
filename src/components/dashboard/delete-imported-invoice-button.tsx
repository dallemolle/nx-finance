"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteImportedInvoice } from "@/lib/credit-card-actions";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

interface DeleteImportedInvoiceButtonProps {
    id: string;
    descricao: string;
    valor: number;
    itemsCount: number;
}

// Exclui uma fatura de cartão importada (real) e todos os itens dela, pra
// refazer uma importação errada (BL-029). Faturas previstas não são afetadas.
export function DeleteImportedInvoiceButton({ id, descricao, valor, itemsCount }: DeleteImportedInvoiceButtonProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleDelete = () => {
        const items = itemsCount === 1 ? "1 item" : `${itemsCount} itens`;
        const message = `Excluir a fatura "${descricao}" (${formatCurrency(valor)}, ${items})?\n\n`
            + "Os itens dela também serão excluídos. As faturas previstas dos próximos meses não são afetadas.\n\n"
            + "Essa ação não pode ser desfeita.";
        if (!confirm(message)) return;
        startTransition(async () => {
            try {
                await deleteImportedInvoice(id);
                toast.success("Fatura excluída.");
                router.refresh();
            } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Erro ao excluir a fatura"));
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
            title="Excluir fatura importada"
            aria-label={`Excluir fatura importada ${descricao}`}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );
}
