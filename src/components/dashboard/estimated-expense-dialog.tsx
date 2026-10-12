"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { estimatedExpenseSchema, type EstimatedExpenseInput } from "@/lib/validations";
import { provisionEstimatedExpense, getCreditCards } from "@/lib/credit-card-provision-actions";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import { addMonths } from "date-fns";
import { cn, formatCurrency, getErrorMessage } from "@/lib/utils";
import { addInvoiceMonths, splitInstallments } from "@/lib/credit-card-cycle";
import type { Category, PaymentMethod, FinancialInstitution, CreditCardDisplay } from "@/types/models";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type RepeatMode = "once" | "installments" | "recurring";

// Prévia mês a mês da parcelada ou da recorrente.
function MonthsPreview({ rows, tagHeader }: { rows: { tag?: string; month: number; year: number; value: number }[]; tagHeader?: string }) {
    return (
        <div className="max-h-[160px] overflow-y-auto rounded-md border bg-background/50 mt-2">
            <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/50 border-b">
                    <tr>
                        {tagHeader && <th className="p-2 font-medium w-16 text-center">{tagHeader}</th>}
                        <th className="p-2 font-medium">Mês</th>
                        <th className="p-2 font-medium text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                            {tagHeader && <td className="p-2 text-center text-muted-foreground">{row.tag}</td>}
                            <td className="p-2 capitalize">{MONTHS[row.month - 1]}/{row.year}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(row.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
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
            getCategories().then(setCategories);
            getPaymentMethods().then(setPaymentMethods);
            getFinancialInstitutions().then(setInstitutions);
            getCreditCards().then(setCreditCards);
        }
    }, [open, userId]);

    const now = new Date();
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EstimatedExpenseInput>({
        resolver: zodResolver(estimatedExpenseSchema),
        defaultValues: {
            invoice_month: now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2,
            invoice_year: now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear(),
            isInstallment: false,
            isRecurring: false,
        },
    });

    const categoriaId = watch("categoria_id");
    const creditCardId = watch("credit_card_id");
    const paymentMethodId = watch("tipo_pagamento_id");
    const institutionId = watch("institution_id");
    const invoiceMonth = Number(watch("invoice_month"));
    const invoiceYear = Number(watch("invoice_year"));
    const isInstallment = watch("isInstallment");
    const isRecurring = watch("isRecurring");
    const recurringMonths = Number(watch("recurringMonths") || 0);
    const repeatMode: RepeatMode = isInstallment ? "installments" : isRecurring ? "recurring" : "once";
    const setRepeatMode = (mode: RepeatMode) => {
        setValue("isInstallment", mode === "installments");
        setValue("isRecurring", mode === "recurring");
        if (mode === "installments" && !installmentsCount) setValue("installmentsCount", 2);
        if (mode === "recurring" && !recurringMonths) setValue("recurringMonths", 12);
    };
    // Mês da linha i da prévia: ciclo da fatura no cartão, mês calendário na genérica.
    const monthAt = (i: number) => useCard
        ? addInvoiceMonths(invoiceMonth, invoiceYear, i)
        : (() => {
            const d = addMonths(new Date(invoiceYear, invoiceMonth - 1, 1), i);
            return { month: d.getMonth() + 1, year: d.getFullYear() };
        })();
    const installmentsCount = Number(watch("installmentsCount") || 0);
    const valorAtual = Number(watch("valor") || 0);

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
                    <DialogDescription>Reserve um gasto que ainda vai acontecer, no cartão ou fora dele, para ele entrar no planejamento dos próximos meses.</DialogDescription>
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
                            <Label htmlFor="ee-categoria">Categoria</Label>
                            <Combobox id="ee-categoria"
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
                            <Label htmlFor="ee-mes">Mês</Label>
                            <Select value={String(invoiceMonth)} onValueChange={(v) => setValue("invoice_month", Number(v))}>
                                <SelectTrigger id="ee-mes"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ee-ano">Ano</Label>
                            <Select value={String(invoiceYear)} onValueChange={(v) => setValue("invoice_year", Number(v))}>
                                <SelectTrigger id="ee-ano"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {years.map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border p-1 bg-muted/20 w-fit">
                        <Button type="button" size="sm" variant={useCard ? "secondary" : "ghost"} aria-pressed={useCard} onClick={() => setUseCard(true)}>No cartão</Button>
                        <Button type="button" size="sm" variant={!useCard ? "secondary" : "ghost"} aria-pressed={!useCard} onClick={() => setUseCard(false)}>Genérica</Button>
                    </div>

                    {useCard ? (
                        <div className="space-y-2">
                            <Label htmlFor="ee-cartao">Cartão</Label>
                            <Combobox id="ee-cartao"
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
                                <Label htmlFor="ee-instituicao">Instituição</Label>
                                <InstitutionCombobox id="ee-instituicao"
                                    options={institutions}
                                    value={institutionId}
                                    onValueChange={(v) => setValue("institution_id", v)}
                                    onAdded={(inst) => setInstitutions(prev => [...prev, inst])}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ee-meio-pagamento">Meio de Pagamento</Label>
                                <Combobox id="ee-meio-pagamento"
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

                    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                        <div className="space-y-2">
                            <p className="text-sm font-medium" id="ee-repeticao-label">Repetição</p>
                            <div role="group" aria-labelledby="ee-repeticao-label" className="flex items-center gap-2 rounded-lg border p-1 bg-background/50 w-fit">
                                {([
                                    ["once", "Uma vez"],
                                    ["installments", "Parcelada"],
                                    ["recurring", "Recorrente"],
                                ] as const).map(([mode, label]) => (
                                    <Button key={mode} type="button" size="sm" variant={repeatMode === mode ? "secondary" : "ghost"} aria-pressed={repeatMode === mode} onClick={() => setRepeatMode(mode)}>
                                        {label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {repeatMode === "installments"
                                    ? "O valor será dividido entre os meses seguintes a partir do mês selecionado."
                                    : repeatMode === "recurring"
                                        ? "O valor cheio se repete todo mês a partir do mês selecionado (assinatura, mensalidade)."
                                        : "Uma única despesa prevista no mês selecionado."}
                            </p>
                        </div>

                        {repeatMode === "installments" && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label htmlFor="installmentsCount">Quantidade de Parcelas</Label>
                                <Input
                                    id="installmentsCount"
                                    type="number"
                                    min={2}
                                    max={48}
                                    {...register("installmentsCount")}
                                    placeholder="Ex: 3"
                                />
                                {errors.installmentsCount && <p className="text-xs text-red-500">{errors.installmentsCount.message as string}</p>}

                                {valorAtual > 0 && installmentsCount > 0 && (
                                    <MonthsPreview
                                        rows={splitInstallments(new Decimal(valorAtual), installmentsCount).map((installment, i) => ({
                                            tag: `${String(i + 1).padStart(2, "0")}/${String(installmentsCount).padStart(2, "0")}`,
                                            ...monthAt(i),
                                            value: installment.value.toNumber(),
                                        }))}
                                        tagHeader="Parc."
                                    />
                                )}
                            </div>
                        )}

                        {repeatMode === "recurring" && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label htmlFor="recurringMonths">Repetir por quantos meses</Label>
                                <Input
                                    id="recurringMonths"
                                    type="number"
                                    min={2}
                                    max={36}
                                    {...register("recurringMonths")}
                                    placeholder="Ex: 12"
                                />
                                {errors.recurringMonths && <p className="text-xs text-red-500">{errors.recurringMonths.message as string}</p>}

                                {valorAtual > 0 && recurringMonths >= 2 && recurringMonths <= 36 && (
                                    <>
                                        <MonthsPreview rows={Array.from({ length: recurringMonths }, (_, i) => ({ ...monthAt(i), value: valorAtual }))} />
                                        <p className="text-xs text-muted-foreground">
                                            Total no período: <span className="font-semibold text-foreground">{formatCurrency(valorAtual * recurringMonths)}</span>
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Lançar Despesa Prevista
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
