"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    updateCategory,
    deleteCategory,
    updateFinancialInstitution,
    deleteFinancialInstitution,
    updatePaymentMethod,
    deletePaymentMethod
} from "@/lib/actions";

interface SettingsItemProps<T> {
    item: T;
    onUpdate: (id: string, data: any) => Promise<any>;
    onDelete: (id: string) => Promise<any>;
    hasColor?: boolean;
}

function SettingsRow({ item, onUpdate, onDelete, hasColor = false }: SettingsItemProps<any>) {
    const [name, setName] = useState(item.nome);
    const [color, setColor] = useState(item.cor || "#64748b");
    const [isPending, setIsPending] = useState(false);

    const isChanged = name !== item.nome || (hasColor && color !== item.cor);

    const handleUpdate = async () => {
        setIsPending(true);
        try {
            const updateData: any = {};
            if (name !== item.nome) updateData.nome = name;
            if (hasColor && color !== item.cor) updateData.cor = color;

            if (Object.keys(updateData).length === 0) return;

            await onUpdate(item.id, updateData);
            toast.success("Atualizado com sucesso!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar");
            setName(item.nome);
            if (hasColor) setColor(item.cor);
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Tem certeza que deseja excluir "${item.nome}"?`)) return;
        
        setIsPending(true);
        try {
            await onDelete(item.id);
            toast.success("Excluído com sucesso!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao excluir");
        } finally {
            setIsPending(false);
        }
    };

    const handleReset = () => {
        setName(item.nome);
        if (hasColor) setColor(item.cor);
    };

    return (
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800/50 last:border-0 group">
            <div className="flex-1 w-full space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome</Label>
                <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="h-9 bg-slate-50 border-none dark:bg-slate-800 focus-visible:ring-1 focus-visible:ring-slate-400"
                />
            </div>
            
            {hasColor && (
                <div className="w-full sm:w-16 space-y-1 shrink-0">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Cor</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            type="color" 
                            value={color} 
                            onChange={(e) => setColor(e.target.value)} 
                            className="h-9 w-full p-1 bg-slate-50 border-none dark:bg-slate-800 cursor-pointer"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 mt-auto pb-0.5">
                {isChanged && (
                    <>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={handleReset}
                            className="h-9 w-9 text-slate-400 hover:text-slate-600"
                            disabled={isPending}
                        >
                            <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={handleUpdate}
                            className="h-9 w-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                            disabled={isPending}
                        >
                            <Save className="h-4 w-4" />
                        </Button>
                    </>
                )}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleDelete}
                    className="h-9 w-9 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    disabled={isPending}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export function InstitutionSettings({ institutions }: { institutions: any[] }) {
    return (
        <div className="space-y-1">
            {institutions.map(inst => (
                <SettingsRow 
                    key={inst.id} 
                    item={inst} 
                    onUpdate={updateFinancialInstitution} 
                    onDelete={deleteFinancialInstitution}
                    hasColor
                />
            ))}
            {institutions.length === 0 && (
                <p className="py-8 text-center text-muted-foreground italic text-sm">Nenhuma instituição encontrada.</p>
            )}
        </div>
    );
}

export function CategorySettings({ categories }: { categories: any[] }) {
    return (
        <div className="space-y-1">
            {categories.map(cat => (
                <SettingsRow 
                    key={cat.id} 
                    item={cat} 
                    onUpdate={updateCategory} 
                    onDelete={deleteCategory}
                    hasColor
                />
            ))}
            {categories.length === 0 && (
                <p className="py-8 text-center text-muted-foreground italic text-sm">Nenhuma categoria encontrada.</p>
            )}
        </div>
    );
}

export function PaymentMethodSettings({ paymentMethods }: { paymentMethods: any[] }) {
    return (
        <div className="space-y-1">
            {paymentMethods.map(pm => (
                <SettingsRow 
                    key={pm.id} 
                    item={pm} 
                    onUpdate={updatePaymentMethod} 
                    onDelete={deletePaymentMethod}
                />
            ))}
            {paymentMethods.length === 0 && (
                <p className="py-8 text-center text-muted-foreground italic text-sm">Nenhum meio de pagamento encontrado.</p>
            )}
        </div>
    );
}
