"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { getCategories, getPaymentMethods } from "@/lib/reports";
import { Pencil } from "lucide-react";

interface EditTransactionDialogProps {
    transaction: any;
    userId: string;
}

export function EditTransactionDialog({ transaction, userId }: EditTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
        }
    }, [open, userId]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Transação</DialogTitle>
                </DialogHeader>
                <TransactionForm
                    initialData={transaction}
                    categories={categories}
                    paymentMethods={paymentMethods}
                    onSuccess={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
