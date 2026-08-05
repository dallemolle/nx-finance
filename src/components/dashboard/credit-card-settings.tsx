"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Pencil, CreditCard as CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCreditCard } from "@/lib/credit-card-provision-actions";
import { getErrorMessage } from "@/lib/utils";
import { CreditCardFormDialog } from "@/components/dashboard/credit-card-form-dialog";
import type { CreditCardDisplay, FinancialInstitution } from "@/types/models";

interface CreditCardSettingsProps {
    creditCards: CreditCardDisplay[];
    institutions: FinancialInstitution[];
}

export function CreditCardSettings({ creditCards: initialCards, institutions: initialInstitutions }: CreditCardSettingsProps) {
    const [cards, setCards] = useState(initialCards);
    const [institutions, setInstitutions] = useState(initialInstitutions);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (card: CreditCardDisplay) => {
        if (!confirm(`Tem certeza que deseja excluir o cartão "${card.nome}"?`)) return;
        setDeletingId(card.id);
        try {
            await deleteCreditCard(card.id);
            setCards(prev => prev.filter(c => c.id !== card.id));
            toast.success("Cartão excluído com sucesso!");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Erro ao excluir cartão"));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <CreditCardFormDialog
                    institutions={institutions}
                    onInstitutionAdded={(inst) => setInstitutions(prev => [...prev, inst])}
                    onSaved={(card) => setCards(prev => [...prev, card])}
                />
            </div>

            <div className="space-y-1">
                {cards.map(card => (
                    <div
                        key={card.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                    >
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${card.cor ?? "#6366f1"}20`, color: card.cor ?? "#6366f1" }}
                        >
                            <CreditCardIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{card.nome}</p>
                            <p className="text-xs text-muted-foreground">
                                {card.institution?.nome} · fecha dia {card.closingDay} · vence dia {card.dueDay}
                                {card.limite ? ` · limite ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(card.limite)}` : ""}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <CreditCardFormDialog
                                institutions={institutions}
                                onInstitutionAdded={(inst) => setInstitutions(prev => [...prev, inst])}
                                onSaved={(updated) => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
                                initialData={card}
                                trigger={
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                }
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(card)}
                                disabled={deletingId === card.id}
                                className="h-9 w-9 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {cards.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground italic text-sm">Nenhum cartão cadastrado.</p>
                )}
            </div>
        </div>
    );
}
