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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionFormProps {
    categories: any[];
    paymentMethods: any[];
    initialData?: any;
    onSuccess: () => void;
}

export function TransactionForm({ categories: initialCategories, paymentMethods: initialPaymentMethods, initialData, onSuccess }: TransactionFormProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState(initialCategories);
    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);

    // Sync state with props when they change
    useEffect(() => {
        setCategories(initialCategories);
    }, [initialCategories]);

    useEffect(() => {
        setPaymentMethods(initialPaymentMethods);
    }, [initialPaymentMethods]);

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

            <div className="grid grid-cols-2 gap-4">
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
                                <p className="text-xs text-blue-500 font-medium">
                                    {installmentsCount} parcelas de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(watch("valor") / installmentsCount)}
                                </p>
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
