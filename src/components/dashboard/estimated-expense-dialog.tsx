"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { estimatedExpenseSchema, type EstimatedExpenseInput } from "@/lib/validations";
import { provisionEstimatedExpense, getCreditCards } from "@/lib/credit-card-provision-actions";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import type { Category, PaymentMethod, FinancialInstitution, CreditCardDisplay } from "@/types/models";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function EstimatedExpenseDialog({ userId, className }: { userId: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [institutions, setInstitutions] = useState<FinancialInstitution[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCardDisplay[]>([]);
    const [useCard, setUseCard] = useState(true);

    useEffect(() => {
        if (open) {
            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
            getFinancialInstitutions(userId).then(setInstitutions);
            getCreditCards(userId).then(setCreditCards);
        }
    }, [open, userId]);

    const now = new Date();
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EstimatedExpenseInput>({
        resolver: zodResolver(estimatedExpenseSchema),
        defaultValues: {
            invoice_month: now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2,
            invoice_year: now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear(),
        },
    });

    const categoriaId = watch("categoria_id");
    const creditCardId = watch("credit_card_id");
    const paymentMethodId = watch("tipo_pagamento_id");
    const institutionId = watch("institution_id");
    const invoiceMonth = Number(watch("invoice_month"));
    const invoiceYear = Number(watch("invoice_year"));

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() + i);

    const onSubmit = (data: EstimatedExpenseInput) => {
        setError(null);
        startTransition(async () => {
            try {
                await provisionEstimatedExpense({
                    ...data,
                    credit_card_id: useCard ? data.credit_card_id : null,
                    tipo_pagamento_id: useCard ? null : data.tipo_pagamento_id,
                    institution_id: useCard ? null : data.institution_id,
                });
                toast.success("Despesa prevista lançada!");
                reset();
                setOpen(false);
                router.refresh();
            } catch (err: unknown) {
                const message = getErrorMessage(err, "Erro ao lançar despesa prevista");
                setError(message);
                toast.error(message);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("gap-2 border-slate-200 dark:border-slate-800", className)}>
                    <CalendarPlus className="h-4 w-4" />
                    Despesa Prevista
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Nova Despesa Prevista</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Input id="descricao" {...register("descricao")} placeholder="Ex: Estimativa de mercado" />
                        {errors.descricao && <p className="text-xs text-red-500">{errors.descricao.message as string}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor Estimado (R$)</Label>
                            <Input id="valor" type="number" step="0.01" {...register("valor")} placeholder="0,00" />
                            {errors.valor && <p className="text-xs text-red-500">{errors.valor.message as string}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Combobox
                                options={categories.filter(c => c.tipo === "SAIDA").map(c => ({ value: c.id, label: c.nome }))}
                                value={categoriaId}
                                onValueChange={(v) => setValue("categoria_id", v)}
                                placeholder="Selecione..."
                                searchPlaceholder="Procurar categoria..."
                                emptyMessage="Categoria não encontrada."
                            />
                            {errors.categoria_id && <p className="text-xs text-red-500">{errors.categoria_id.message as string}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Mês</Label>
                            <Select value={String(invoiceMonth)} onValueChange={(v) => setValue("invoice_month", Number(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Ano</Label>
                            <Select value={String(invoiceYear)} onValueChange={(v) => setValue("invoice_year", Number(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {years.map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border p-1 bg-muted/20 w-fit">
                        <Button type="button" size="sm" variant={useCard ? "secondary" : "ghost"} onClick={() => setUseCard(true)}>No cartão</Button>
                        <Button type="button" size="sm" variant={!useCard ? "secondary" : "ghost"} onClick={() => setUseCard(false)}>Genérica</Button>
                    </div>

                    {useCard ? (
                        <div className="space-y-2">
                            <Label>Cartão</Label>
                            <Combobox
                                options={creditCards.map(c => ({ value: c.id, label: c.nome }))}
                                value={creditCardId ?? ""}
                                onValueChange={(v) => setValue("credit_card_id", v)}
                                placeholder="Selecione o cartão..."
                                searchPlaceholder="Procurar cartão..."
                                emptyMessage="Nenhum cartão cadastrado."
                            />
                            {errors.credit_card_id && <p className="text-xs text-red-500">{errors.credit_card_id.message as string}</p>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Instituição</Label>
                                <InstitutionCombobox
                                    options={institutions}
                                    value={institutionId}
                                    onValueChange={(v) => setValue("institution_id", v)}
                                    onAdded={(inst) => setInstitutions(prev => [...prev, inst])}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Meio de Pagamento</Label>
                                <Combobox
                                    options={paymentMethods.map(p => ({ value: p.id, label: p.nome }))}
                                    value={paymentMethodId ?? ""}
                                    onValueChange={(v) => setValue("tipo_pagamento_id", v)}
                                    placeholder="Selecione..."
                                    searchPlaceholder="Procurar meio..."
                                    emptyMessage="Não encontrado."
                                />
                            </div>
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Lançar Despesa Prevista
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
