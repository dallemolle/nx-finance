"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { transactionSchema } from "@/lib/validations";
import { createTransaction, updateTransaction, getCategories, getPaymentMethods } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function TransactionForm({ userId, initialData, onSuccess }: any) {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: initialData ? {
            ...initialData,
            valor: initialData.valor.toString(),
            data_vencimento: new Date(initialData.data_vencimento)
        } : {
            tipo: "SAIDA",
            status: "PENDENTE",
            data_vencimento: new Date(),
        },
    });

    useEffect(() => {
        async function loadOptions() {
            const [cats, pm] = await Promise.all([
                getCategories(userId),
                getPaymentMethods(userId)
            ]);
            setCategories(cats);
            setPaymentMethods(pm);
        }
        loadOptions();
    }, [userId]);

    async function onSubmit(values: z.infer<typeof transactionSchema>) {
        setLoading(true);
        try {
            if (initialData) {
                await updateTransaction(initialData.id, values);
            } else {
                await createTransaction({ ...values, userId });
            }
            onSuccess();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="flex justify-center mb-4">
                <Tabs
                    value={form.watch("tipo")}
                    onValueChange={(v: any) => form.setValue("tipo", v)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 rounded-xl max-w-[300px] mx-auto">
                        <TabsTrigger value="SAIDA" className="rounded-lg data-[state=active]:bg-rose-500 data-[state=active]:text-white">Despesa</TabsTrigger>
                        <TabsTrigger value="ENTRADA" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Receita</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                        <Input
                            placeholder="0,00"
                            className="pl-9 h-11 text-lg font-semibold rounded-xl bg-background/50 border-muted group-focus-within:border-primary"
                            {...form.register("valor")}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                    <Select
                        value={form.watch("status")}
                        onValueChange={(v: any) => form.setValue("status", v)}
                    >
                        <SelectTrigger className="h-11 rounded-xl bg-background/50 border-muted">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                            <SelectItem value="PAGO">Pago</SelectItem>
                            <SelectItem value="ATRASADO">Atrasado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                <Input
                    placeholder="Ex: Aluguel, Supermercado..."
                    className="h-11 rounded-xl bg-background/50 border-muted"
                    {...form.register("descricao")}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vencimento</Label>
                    <DatePicker
                        date={form.watch("data_vencimento")}
                        setDate={(d) => d && form.setValue("data_vencimento", d)}
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                    <Combobox
                        options={categories.filter(c => c.tipo === form.watch("tipo")).map(c => ({
                            label: c.nome,
                            value: c.id,
                            color: c.cor
                        }))}
                        value={form.watch("categoria_id")}
                        onChange={(v) => form.setValue("categoria_id", v)}
                        placeholder="Selecione..."
                        onAdd={(name) => console.log("Add cat:", name)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
                <Combobox
                    options={paymentMethods.map(p => ({
                        label: p.nome,
                        value: p.id
                    }))}
                    value={form.watch("tipo_pagamento_id") || ""}
                    onChange={(v) => form.setValue("tipo_pagamento_id", v)}
                    placeholder="Selecione..."
                    onAdd={(name) => console.log("Add method:", name)}
                />
            </div>

            <div className="pt-4">
                <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold rounded-xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                    disabled={loading}
                >
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {initialData ? "Atualizar" : "Salvar Lançamento"}
                </Button>
            </div>
        </form>
    );
}
