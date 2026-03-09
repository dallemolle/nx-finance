"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { getCategories, getPaymentMethods } from "@/lib/reports";
import { Plus } from "lucide-react";

export function NewTransactionDialog({ userId }: { userId: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
        }
    }, [open, userId]);

    const handleSuccess = () => {
        setOpen(false);
        router.refresh(); // Trigger native Next.js revalidation
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Transação
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adicionar Transação</DialogTitle>
                </DialogHeader>
                <TransactionForm
                    categories={categories}
                    paymentMethods={paymentMethods}
                    onSuccess={handleSuccess}
                />
            </DialogContent>
        </Dialog>
    );
}
