"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { payTransaction } from "@/lib/actions";

interface QuickPayButtonProps {
    transactionId: string;
}

export function QuickPayButton({ transactionId }: QuickPayButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handlePay = () => {
        startTransition(async () => {
            try {
                await payTransaction(transactionId);
                toast.success("Lançamento liquidado!");
            } catch (error) {
                toast.error("Erro ao liquidar lançamento");
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:h-8 md:w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
            onClick={handlePay}
            disabled={isPending}
            title="Liquidar"
        >
            <Check className="h-4 w-4" />
        </Button>
    );
}
