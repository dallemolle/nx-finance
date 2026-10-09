"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CardInstallmentPurchaseForm } from "./card-installment-purchase-form";
import { getCategories } from "@/lib/reports";
import { getCreditCards } from "@/lib/credit-card-provision-actions";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, CreditCardDisplay } from "@/types/models";

export function CardInstallmentPurchaseDialog({ userId, className }: { userId: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCardDisplay[]>([]);

    useEffect(() => {
        if (open) {
            getCategories(userId).then(setCategories);
            getCreditCards(userId).then(setCreditCards);
        }
    }, [open, userId]);

    const handleSuccess = () => {
        setOpen(false);
        router.refresh();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("gap-2 border-slate-200 dark:border-slate-800", className)}>
                    <ShoppingCart className="h-4 w-4" />
                    Compra Parcelada
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Nova Compra Parcelada no Cartão</DialogTitle>
                </DialogHeader>
                <CardInstallmentPurchaseForm categories={categories} creditCards={creditCards} onSuccess={handleSuccess} />
            </DialogContent>
        </Dialog>
    );
}
