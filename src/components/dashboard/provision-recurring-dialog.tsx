"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { Combobox } from "@/components/ui/combobox";
import { provisionRecurringTransactions } from "@/lib/provision-actions";
import { createCategory, createPaymentMethod } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Decimal } from "decimal.js";

export function ProvisionRecurringDialog({ userId, className }: { userId: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [categoriaId, setCategoriaId] = useState("");
    const [paymentMethodId, setPaymentMethodId] = useState("");
    const [institutionId, setInstitutionId] = useState("");
    const [startMonth, setStartMonth] = useState((new Date().getMonth() + 1).toString());
    const [startYear, setStartYear] = useState(new Date().getFullYear().toString());
    const [totalMonths, setTotalMonths] = useState("12");

    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [institutions, setInstitutions] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDescricao("");
            setValor("");
            setCategoriaId("");
            setPaymentMethodId("");
            setInstitutionId("");
            setError(null);

            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
            getFinancialInstitutions(userId).then(setInstitutions);
        }
    }, [open, userId]);

    const previewRows = (() => {
        if (!descricao || !valor || !totalMonths) return [];
        const count = parseInt(totalMonths);
        if (isNaN(count) || count < 1) return [];

        const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
        const totalValue = new Decimal(parseFloat(valor) || 0);
        const installmentValue = totalValue.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
        const lastValue = totalValue.minus(installmentValue.times(count - 1));

        return Array.from({ length: count }).map((_, i) => {
            const val = i === count - 1 ? lastValue : installmentValue;
            return {
                num: i + 1,
                desc: `${descricao.trim()} (${String(i + 1).padStart(2, "0")}/${String(count).padStart(2, "0")})`,
                dueDate: addMonths(startDate, i),
                valor: val.toNumber(),
                isAdjusted: i === count - 1 && !lastValue.equals(installmentValue),
            };
        });
    })();

    const totalPreview = previewRows.reduce((sum, r) => sum + r.valor, 0);

    const handleSubmit = async () => {
        if (!descricao.trim()) { setError("Descrição é obrigatória"); return; }
        if (!valor || parseFloat(valor) <= 0) { setError("Valor deve ser positivo"); return; }
        if (!categoriaId) { setError("Selecione uma categoria"); return; }
        if (!paymentMethodId) { setError("Selecione um meio de pagamento"); return; }
        if (!institutionId) { setError("Selecione uma instituição"); return; }

        setIsLoading(true);
        setError(null);

        try {
            const result = await provisionRecurringTransactions({
                descricao: descricao.trim(),
                valor: parseFloat(valor),
                categoria_id: categoriaId,
                tipo_pagamento_id: paymentMethodId,
                institution_id: institutionId,
                startMonth: parseInt(startMonth),
                startYear: parseInt(startYear),
                totalMonths: parseInt(totalMonths),
            });

            if (result.success) {
                setOpen(false);
                router.refresh();
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategoryCreate = async (name: string) => {
        try {
            const newCat = await createCategory({
                nome: name, cor: "#3b82f6", icone: "Wallet", tipo: "SAIDA",
            });
            setCategories(prev => [...prev, newCat]);
            setCategoriaId(newCat.id);
        } catch { /* ignore */ }
    };

    const handlePaymentMethodAdd = async (name: string) => {
        try {
            const newPM = await createPaymentMethod({ nome: name });
            setPaymentMethods(prev => [...prev, newPM]);
            setPaymentMethodId(newPM.id);
        } catch { /* ignore */ }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("flex items-center gap-2", className)}>
                    <CalendarDays className="h-4 w-4" />
                    Provisionar
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Provisionar Despesas Recorrentes</DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Descrição Base</Label>
                            <Input
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Ex: Conta de Água"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Valor Mensal (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                placeholder="89,90"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Total de Meses</Label>
                            <Input
                                type="number"
                                min={1}
                                max={60}
                                value={totalMonths}
                                onChange={(e) => setTotalMonths(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Mês Início</Label>
                            <select
                                value={startMonth}
                                onChange={(e) => setStartMonth(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {format(new Date(2000, i, 1), "MMMM", { locale: ptBR })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Ano Início</Label>
                            <Input
                                type="number"
                                min={2020}
                                max={2100}
                                value={startYear}
                                onChange={(e) => setStartYear(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Combobox
                                options={categories
                                    .filter((c: any) => c.tipo === "SAIDA")
                                    .map((c: any) => ({ value: c.id, label: c.nome }))
                                }
                                value={categoriaId}
                                onValueChange={setCategoriaId}
                                onAdd={handleCategoryCreate}
                                placeholder="Selecione..."
                                searchPlaceholder="Buscar categoria..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Meio de Pagamento</Label>
                            <Combobox
                                options={paymentMethods.map((p: any) => ({ value: p.id, label: p.nome }))}
                                value={paymentMethodId}
                                onValueChange={setPaymentMethodId}
                                onAdd={handlePaymentMethodAdd}
                                placeholder="Selecione..."
                                searchPlaceholder="Buscar meio..."
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label>Instituição Financeira</Label>
                            <InstitutionCombobox
                                options={institutions}
                                value={institutionId}
                                onValueChange={setInstitutionId}
                                onAdded={(newInst) => {
                                    setInstitutions([...institutions, newInst]);
                                    setInstitutionId(newInst.id);
                                }}
                            />
                        </div>
                    </div>

                    {previewRows.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    Prévia das Provisões
                                </Label>
                                <span className="text-sm font-bold text-rose-600">
                                    Total: {formatCurrency(totalPreview)}
                                </span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto rounded-md border bg-background/50">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-2 font-medium w-12 text-center">#</th>
                                            <th className="p-2 font-medium">Descrição</th>
                                            <th className="p-2 font-medium">Vencimento</th>
                                            <th className="p-2 font-medium text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row) => (
                                            <tr key={row.num} className={cn("border-b last:border-0", row.isAdjusted && "bg-blue-50/50 dark:bg-blue-900/20")}>
                                                <td className="p-2 text-center text-muted-foreground">{String(row.num).padStart(2, "0")}</td>
                                                <td className="p-2">{row.desc}</td>
                                                <td className="p-2">{format(row.dueDate, "MMM/yyyy", { locale: ptBR })}</td>
                                                <td className={cn("p-2 text-right font-medium", row.isAdjusted && "text-blue-600 dark:text-blue-400")}>
                                                    {formatCurrency(row.valor)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">
                                * Todos os registros serão criados como <strong>provisionados</strong> (is_provisioned: true).
                                Após confirmar o gasto real, reconcilie-os na tela de importação.
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-auto border-t flex justify-end gap-2 shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
                        ) : (
                            `Gerar ${previewRows.length} Provisões`
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
