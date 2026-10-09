"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { creditCardSchema, type CreditCardInput } from "@/lib/validations";
import { createCreditCard, updateCreditCard } from "@/lib/credit-card-provision-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import type { FinancialInstitution, CreditCardDisplay } from "@/types/models";

interface CreditCardFormDialogProps {
    institutions: FinancialInstitution[];
    onInstitutionAdded: (inst: FinancialInstitution) => void;
    onSaved: (card: CreditCardDisplay) => void;
    initialData?: CreditCardDisplay;
    trigger?: React.ReactNode;
}

export function CreditCardFormDialog({ institutions, onInstitutionAdded, onSaved, initialData, trigger }: CreditCardFormDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CreditCardInput>({
        resolver: zodResolver(creditCardSchema),
        defaultValues: initialData ? {
            nome: initialData.nome,
            institution_id: initialData.institution_id,
            closingDay: initialData.closingDay,
            dueDay: initialData.dueDay,
            limite: initialData.limite ?? undefined,
            cor: initialData.cor ?? "#6366f1",
        } : {
            cor: "#6366f1",
        },
    });

    useEffect(() => {
        if (open && initialData) {
            reset({
                nome: initialData.nome,
                institution_id: initialData.institution_id,
                closingDay: initialData.closingDay,
                dueDay: initialData.dueDay,
                limite: initialData.limite ?? undefined,
                cor: initialData.cor ?? "#6366f1",
            });
        }
    }, [open, initialData, reset]);

    const institutionId = watch("institution_id");

    const onSubmit = async (data: CreditCardInput) => {
        setIsPending(true);
        try {
            const result = initialData
                ? await updateCreditCard(initialData.id, data)
                : await createCreditCard(data);
            toast.success(initialData ? "Cartão atualizado!" : "Cartão criado!");
            onSaved(result.data as CreditCardDisplay);
            setOpen(false);
            if (!initialData) reset({ cor: "#6366f1" });
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Erro ao salvar cartão"));
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Cartão
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Cartão</Label>
                        <Input id="nome" {...register("nome")} placeholder="Ex: Nubank Roxinho" />
                        {errors.nome && <p className="text-xs text-red-500">{errors.nome.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Instituição Emissora</Label>
                        <InstitutionCombobox
                            options={institutions}
                            value={institutionId}
                            onValueChange={(v) => setValue("institution_id", v)}
                            onAdded={onInstitutionAdded}
                        />
                        {errors.institution_id && <p className="text-xs text-red-500">{errors.institution_id.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="closingDay">Dia de Fechamento</Label>
                            <Input id="closingDay" type="number" min={1} max={31} {...register("closingDay")} placeholder="Ex: 25" />
                            {errors.closingDay && <p className="text-xs text-red-500">{errors.closingDay.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDay">Dia de Vencimento</Label>
                            <Input id="dueDay" type="number" min={1} max={31} {...register("dueDay")} placeholder="Ex: 5" />
                            {errors.dueDay && <p className="text-xs text-red-500">{errors.dueDay.message as string}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="limite">Limite (opcional)</Label>
                            <Input id="limite" type="number" step="0.01" {...register("limite")} placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cor">Cor</Label>
                            <div className="flex gap-2 items-center">
                                <input
                                    id="cor"
                                    type="color"
                                    className="w-11 h-9 p-1 cursor-pointer bg-transparent border rounded-md"
                                    {...register("cor")}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
