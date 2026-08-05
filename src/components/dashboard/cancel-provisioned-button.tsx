"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTransaction } from "@/lib/actions";
import { deleteProvisionedInvoiceItem } from "@/lib/credit-card-provision-actions";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

interface CancelProvisionedButtonProps {
    // "transaction": despesa prevista genérica (sem cartão), exclui a Transaction inteira.
    // "invoiceItem": parcela futura ou estimativa dentro de uma fatura projetada, exclui só o item.
    kind: "transaction" | "invoiceItem";
    id: string;
}

export function CancelProvisionedButton({ kind, id }: CancelProvisionedButtonProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleCancel = () => {
        if (!confirm("Excluir este lançamento previsto? Essa ação não pode ser desfeita.")) return;
        startTransition(async () => {
            try {
                if (kind === "transaction") {
                    await deleteTransaction(id);
                } else {
                    await deleteProvisionedInvoiceItem(id);
                }
                toast.success("Lançamento previsto excluído!");
                router.refresh();
            } catch (err: unknown) {
                toast.error(getErrorMessage(err, "Erro ao excluir lançamento previsto"));
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:h-8 md:w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            onClick={handleCancel}
            disabled={isPending}
            title="Excluir previsão"
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    );
}
