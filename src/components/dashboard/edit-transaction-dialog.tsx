"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { Pencil } from "lucide-react";

interface EditTransactionDialogProps {
    transaction: any;
    userId: string;
}

export function EditTransactionDialog({ transaction, userId }: EditTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [institutions, setInstitutions] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
            getFinancialInstitutions(userId).then(setInstitutions);
        }
    }, [open, userId]);

    const handleSuccess = () => {
        setOpen(false);
        router.refresh(); // Trigger native Next.js revalidation
    };

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
                    institutions={institutions}
                    onSuccess={handleSuccess}
                />
            </DialogContent>
        </Dialog>
    );
}
