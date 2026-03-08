"use client";

import { useEffect, useState } from "react";
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

interface TransactionFormProps {
    categories: any[];
    paymentMethods: any[];
    initialData?: any;
    onSuccess: () => void;
}

export function TransactionForm({ categories: initialCategories, paymentMethods: initialPaymentMethods, initialData, onSuccess }: TransactionFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState(initialCategories);
    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);

    // Sync state with props when they change (e.g. after async fetch)
    useEffect(() => {
        setCategories(initialCategories);
    }, [initialCategories]);

    useEffect(() => {
        setPaymentMethods(initialPaymentMethods);
    }, [initialPaymentMethods]);

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
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

    const onSubmit = async (data: any) => {
        setLoading(true);
        setError(null);
        try {
            if (initialData?.id) {
                await updateTransaction(initialData.id, data);
            } else {
                await createTransaction(data);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Erro ao salvar transação");
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (name: string) => {
        try {
            const newCat = await createCategory({
                nome: name,
                cor: "#3b82f6", // Default blue
                icone: "Wallet", // Default icon
                tipo: tipo,
            });
            setCategories([...categories, newCat]);
            setValue("categoria_id", newCat.id);
        } catch (err: any) {
            setError("Erro ao criar categoria: " + err.message);
        }
    };

    const handleAddPaymentMethod = async (name: string) => {
        try {
            const newPM = await createPaymentMethod({ nome: name });
            setPaymentMethods([...paymentMethods, newPM]);
            setValue("tipo_pagamento_id", newPM.id);
        } catch (err: any) {
            setError("Erro ao criar meio de pagamento: " + err.message);
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
                    <Select onValueChange={(v) => setValue("tipo", v as any)} defaultValue={initialData?.tipo || "SAIDA"}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ENTRADA">Receita (Entrada)</SelectItem>
                            <SelectItem value="SAIDA">Despesa (Saída)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select onValueChange={(v) => setValue("status", v as any)} defaultValue={initialData?.status || "PENDENTE"}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                            <SelectItem value="PAGO">Pago</SelectItem>
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

            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : initialData ? "Atualizar Registro" : "Adicionar Transação"}
            </Button>
        </form>
    );
}
