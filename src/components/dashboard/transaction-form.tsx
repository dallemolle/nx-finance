"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema } from "@/lib/validations";
import { createTransaction, updateTransaction, createCategory, createPaymentMethod } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Decimal } from "decimal.js";
import { cn } from "@/lib/utils";

interface TransactionFormProps {
    categories: any[];
    paymentMethods: any[];
    institutions: any[];
    initialData?: any;
    onSuccess: () => void;
}

export function TransactionForm({ categories: initialCategories, paymentMethods: initialPaymentMethods, institutions: initialInstitutions, initialData, onSuccess }: TransactionFormProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState(initialCategories);
    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);
    const [institutions, setInstitutions] = useState(initialInstitutions);

    // Sync state with props when they change
    useEffect(() => {
        setCategories(initialCategories);
    }, [initialCategories]);

    useEffect(() => {
        setPaymentMethods(initialPaymentMethods);
    }, [initialPaymentMethods]);

    useEffect(() => {
        setInstitutions(initialInstitutions);
    }, [initialInstitutions]);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
        resolver: zodResolver(transactionSchema),
        defaultValues: initialData ? {
            ...initialData,
            data_vencimento: new Date(initialData.data_vencimento),
            valor: Number(initialData.valor),
        } : {
            tipo: "SAIDA",
            status: "PENDENTE",
            data_vencimento: new Date(),
        }
    });

    const tipo = watch("tipo");
    const dataVencimento = watch("data_vencimento");
    const categoriaId = watch("categoria_id");
    const paymentMethodId = watch("tipo_pagamento_id");
    const institutionId = watch("institution_id");
    const isInstallment = watch("isInstallment");
    const installmentsCount = watch("installmentsCount");

    const onSubmit = (data: any) => {
        setError(null);
        startTransition(async () => {
            try {
                if (initialData?.id) {
                    await updateTransaction(initialData.id, data);
                    toast.success("Transação atualizada com sucesso!");
                } else {
                    await createTransaction(data);
                    toast.success("Transação realizada com sucesso!");
                }
                reset();
                onSuccess();
            } catch (err: any) {
                const message = err.message || "Erro ao salvar transação";
                setError(message);
                toast.error(message);
            }
        });
    };

    const handleAddCategory = async (name: string) => {
        try {
            const newCat = await createCategory({
                nome: name,
                cor: "#3b82f6",
                icone: "Wallet",
                tipo: tipo,
            });
            setCategories([...categories, newCat]);
            setValue("categoria_id", newCat.id);
            toast.success(`Categoria "${name}" criada!`);
        } catch (err: any) {
            toast.error("Erro ao criar categoria: " + err.message);
        }
    };

    const handleAddPaymentMethod = async (name: string) => {
        try {
            const newPM = await createPaymentMethod({ nome: name });
            setPaymentMethods([...paymentMethods, newPM]);
            setValue("tipo_pagamento_id", newPM.id);
            toast.success(`Meio "${name}" criado!`);
        } catch (err: any) {
            toast.error("Erro ao criar meio de pagamento: " + err.message);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select onValueChange={(v) => setValue("tipo", v as any)} value={tipo}>
                        <SelectTrigger className="cursor-pointer">
                            <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto">
                            <SelectItem value="ENTRADA" className="cursor-pointer">Receita (Entrada)</SelectItem>
                            <SelectItem value="SAIDA" className="cursor-pointer">Despesa (Saída)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select onValueChange={(v) => setValue("status", v as any)} value={watch("status")}>
                        <SelectTrigger className="cursor-pointer">
                            <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto">
                            <SelectItem value="PENDENTE" className="cursor-pointer">Pendente</SelectItem>
                            <SelectItem value="ATRASADO" className="cursor-pointer">Atrasado</SelectItem>
                            <SelectItem value="PAGO" className="cursor-pointer">Pago</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input id="descricao" {...register("descricao")} placeholder="Ex: Aluguel, Salário, etc" />
                {errors.descricao && <p className="text-xs text-red-500">{errors.descricao.message as string}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input id="valor" type="number" step="0.01" {...register("valor")} placeholder="0,00" />
                    {errors.valor && <p className="text-xs text-red-500">{errors.valor.message as string}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Data de Vencimento</Label>
                    <DatePicker
                        date={dataVencimento}
                        setDate={(d) => setValue("data_vencimento", d as Date)}
                    />
                    {errors.data_vencimento && <p className="text-xs text-red-500">{errors.data_vencimento.message as string}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Instituição Financeira</Label>
                    <InstitutionCombobox
                        options={institutions}
                        value={institutionId}
                        onValueChange={(v) => setValue("institution_id", v)}
                        onAdded={(newInst) => {
                            setInstitutions([...institutions, newInst]);
                            setValue("institution_id", newInst.id);
                        }}
                    />
                    {errors.institution_id && <p className="text-xs text-red-500">{errors.institution_id.message as string}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Combobox
                        options={categories
                            .filter(c => c.tipo === tipo)
                            .map(c => ({ value: c.id, label: c.nome }))
                        }
                        value={categoriaId}
                        onValueChange={(v) => setValue("categoria_id", v)}
                        onAdd={handleAddCategory}
                        placeholder="Selecione ou crie..."
                        searchPlaceholder="Procurar categoria..."
                        emptyMessage="Categoria não encontrada."
                    />
                    {errors.categoria_id && <p className="text-xs text-red-500">{errors.categoria_id.message as string}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Meio de Pagamento</Label>
                    <Combobox
                        options={paymentMethods.map(p => ({ value: p.id, label: p.nome }))}
                        value={paymentMethodId}
                        onValueChange={(v) => setValue("tipo_pagamento_id", v)}
                        onAdd={handleAddPaymentMethod}
                        placeholder="Selecione ou crie..."
                        searchPlaceholder="Procurar meio..."
                        emptyMessage="Não encontrado."
                    />
                    {errors.tipo_pagamento_id && <p className="text-xs text-red-500">{errors.tipo_pagamento_id.message as string}</p>}
                </div>
            </div>

            {tipo === "SAIDA" && !initialData && (
                <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Despesa Parcelada?</Label>
                            <p className="text-xs text-muted-foreground">O valor total será dividido entre as parcelas.</p>
                        </div>
                        <Switch
                            checked={isInstallment}
                            onCheckedChange={(checked) => {
                                setValue("isInstallment", checked);
                                if (checked && !installmentsCount) {
                                    setValue("installmentsCount", 2);
                                }
                            }}
                        />
                    </div>

                    {isInstallment && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label htmlFor="installmentsCount">Quantidade de Parcelas</Label>
                            <Input
                                id="installmentsCount"
                                type="number"
                                min={2}
                                max={48}
                                {...register("installmentsCount")}
                                placeholder="Ex: 12"
                            />
                            {errors.installmentsCount && <p className="text-xs text-red-500">{errors.installmentsCount.message as string}</p>}
                            {watch("valor") > 0 && installmentsCount > 0 && (
                                <div className="mt-4 space-y-2 border-t pt-4">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prévia das Parcelas</p>
                                    <div className="max-h-[200px] overflow-y-auto rounded-md border bg-background/50">
                                        <table className="w-full text-left text-xs">
                                            <thead className="sticky top-0 bg-muted/50 border-b">
                                                <tr>
                                                    <th className="p-2 font-medium">Parc.</th>
                                                    <th className="p-2 font-medium">Vencimento</th>
                                                    <th className="p-2 font-medium text-right">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Array.from({ length: installmentsCount }).map((_, i) => {
                                                    const totalValue = new Decimal(watch("valor") || 0);
                                                    const count = Number(installmentsCount);
                                                    const installmentValue = totalValue.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
                                                    const lastInstallmentValue = totalValue.minus(installmentValue.times(count - 1));

                                                    const currentVal = i === count - 1 ? lastInstallmentValue : installmentValue;
                                                    const dueDate = addMonths(new Date(dataVencimento), i);
                                                    const isAdjusted = i === count - 1 && !lastInstallmentValue.equals(installmentValue);

                                                    return (
                                                        <tr key={i} className={cn("border-b last:border-0", isAdjusted && "bg-blue-50/50 dark:bg-blue-900/20")}>
                                                            <td className="p-2">{String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</td>
                                                            <td className="p-2">{format(dueDate, "dd/MM/yyyy")}</td>
                                                            <td className={cn("p-2 text-right font-medium", isAdjusted && "text-blue-600 dark:text-blue-400")}>
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentVal.toNumber())}
                                                                {isAdjusted && <span className="ml-1 text-[10px] opacity-70" title="Ajuste de centavos">*</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic">
                                        * A última parcela contém o ajuste de centavos para garantir a precisão do valor total.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                    </>
                ) : initialData ? (
                    "Atualizar Registro"
                ) : (
                    "Adicionar Transação"
                )}
            </Button>
        </form>
    );
}
