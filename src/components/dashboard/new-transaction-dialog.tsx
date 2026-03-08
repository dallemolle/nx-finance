"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

export function NewTransactionDialog({ userId }: { userId: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                    <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="p-6 bg-gradient-to-br from-background to-muted/30">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-bold tracking-tight">Nova Transação</DialogTitle>
                    </DialogHeader>
                    <TransactionForm
                        userId={userId}
                        onSuccess={() => setOpen(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
