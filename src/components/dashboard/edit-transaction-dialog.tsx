"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

interface EditTransactionDialogProps {
    transaction: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
}

export function EditTransactionDialog({ transaction, open, onOpenChange, userId }: EditTransactionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="p-6 bg-gradient-to-br from-background to-muted/30">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-bold tracking-tight">Editar Transação</DialogTitle>
                    </DialogHeader>
                    <TransactionForm
                        userId={userId}
                        initialData={transaction}
                        onSuccess={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
