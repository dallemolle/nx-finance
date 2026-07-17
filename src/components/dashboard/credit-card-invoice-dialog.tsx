"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Upload, ChevronRight, X, AlertCircle, Loader2, ToggleLeft, Repeat } from "lucide-react";
import Papa from "papaparse";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { importCreditCardInvoice } from "@/lib/credit-card-actions";
import { getMappingSuggestions } from "@/lib/csv-actions";
import { cn } from "@/lib/utils";
import { createCategory, createPaymentMethod } from "@/lib/actions";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";

interface ParsedRow {
    id: number;
    title: string;
    amount: number;
    date: string;
    category_id: string;
    isInstallment: boolean;
    totalInstallments: number;
    currentInstallment: number;
    uniqueInstallmentGroup: string;
}

export function CreditCardInvoiceDialog({ userId, className }: { userId: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Header config
    const [invoiceDescription, setInvoiceDescription] = useState("");
    const [dueDate, setDueDate] = useState<string>("");
    const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
    const [institutionId, setInstitutionId] = useState<string>("");
    const [isReconciliation, setIsReconciliation] = useState(false);

    // Data
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [institutions, setInstitutions] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setStep(1);
            setFile(null);
            setInvoiceDescription("");
            setDueDate("");
            setPaymentMethodId("none");
            setInstitutionId("");
            setParsedData([]);
            setError(null);
            setIsReconciliation(false);

            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
            getFinancialInstitutions(userId).then(setInstitutions);
            getMappingSuggestions().then(setSuggestions).catch(console.error);
        }
    }, [open, userId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleContinue = () => {
        if (!file) {
            setError("Por favor, selecione um arquivo CSV");
            return;
        }
        if (!invoiceDescription.trim()) {
            setError("Descrição da fatura é obrigatória");
            return;
        }
        if (!dueDate) {
            setError("Data de vencimento da fatura é obrigatória");
            return;
        }
        if (!institutionId) {
            setError("Selecione a Instituição Financeira (bandeira do cartão)");
            return;
        }
        if (paymentMethodId === "none") {
            setError("Selecione um Meio de Pagamento para a fatura");
            return;
        }

        setIsLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                try {
                    const mapped: ParsedRow[] = results.data.map((row: any, index: number) => {
                        const title = row.title || row.descricao || row.description || row.Title || Object.values(row)[0] || "Sem título";
                        const rawAmount = row.amount || row.valor || row.Value || row.Amount || "0";
                        const amount = parseFloat(String(rawAmount).replace(/[R$\s]/g, '').replace(',', '.'));
                        const rawDate = row.date || row.data || row.Date || row.Data || row.data_compra || "";
                        const parsed = new Date(rawDate);
                        const date = !isNaN(parsed.getTime())
                            ? parsed.toISOString().split('T')[0]
                            : rawDate.includes('/')
                                ? rawDate.split('/').reverse().join('-')
                                : new Date().toISOString().split('T')[0];

                        const guess = suggestions.find((s: any) => title.toLowerCase().includes(s.search_term));

                        // Try to detect installment info from CSV columns
                        const rawTotal = row.total_installments || row.total_parcelas || "";
                        const rawCurrent = row.current_installment || row.parcela_atual || "";
                        const rawGroup = row.installment_group || row.grupo_parcelamento || "";

                        const totalInst = parseInt(rawTotal) || 0;
                        const currentInst = parseInt(rawCurrent) || 0;
                        const isInst = totalInst >= 2;

                        return {
                            id: index,
                            title,
                            amount: isNaN(amount) ? 0 : Math.abs(amount),
                            date,
                            category_id: guess ? guess.categoria_id : "",
                            isInstallment: isInst,
                            totalInstallments: isInst ? totalInst : 0,
                            currentInstallment: isInst ? currentInst : 1,
                            uniqueInstallmentGroup: rawGroup || "",
                        };
                    });

                    setParsedData(mapped);
                    setStep(2);
                    setError(null);
                } catch (e) {
                    setError("Erro ao processar CSV. Verifique o formato das colunas (title, amount, date).");
                } finally {
                    setIsLoading(false);
                }
            },
            error: (err: any) => {
                setError(err.message);
                setIsLoading(false);
            }
        });
    };

    const handleRowChange = (id: number, field: string, value: any) => {
        setParsedData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleCategoryCreate = async (id: number, catName: string) => {
        try {
            const newCat = await createCategory({
                nome: catName,
                cor: "#3b82f6",
                icone: "Wallet",
                tipo: "SAIDA",
            });
            setCategories(prev => [...prev, newCat]);
            handleRowChange(id, "category_id", newCat.id);
        } catch (e: any) {
            console.error(e);
        }
    };

    const handlePaymentMethodAdd = async (name: string) => {
        try {
            const newPM = await createPaymentMethod({ nome: name });
            setPaymentMethods(prev => [...prev, newPM]);
            setPaymentMethodId(newPM.id);
        } catch (e: any) {
            console.error(e);
        }
    };

    const handleSubmit = async () => {
        const hasMissingCategories = parsedData.some(r => !r.category_id);
        if (hasMissingCategories) {
            setError("Atribua uma categoria para todos os itens antes de confirmar.");
            return;
        }

        if (parsedData.length === 0) {
            setError("Nenhum item para importar.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await importCreditCardInvoice({
                descricao: invoiceDescription,
                data_vencimento: dueDate,
                institution_id: institutionId,
                tipo_pagamento_id: paymentMethodId,
                isReconciliation,
                items: parsedData.map(row => ({
                    descricao: row.title,
                    valor: Math.abs(row.amount),
                    categoria_id: row.category_id,
                    data_compra: row.date,
                    isInstallment: row.isInstallment,
                    totalInstallments: row.isInstallment ? row.totalInstallments : null,
                    currentInstallment: row.isInstallment ? row.currentInstallment : null,
                    uniqueInstallmentGroup: row.isInstallment && row.uniqueInstallmentGroup ? row.uniqueInstallmentGroup : null,
                })),
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

    const totalAmount = parsedData.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={cn("flex items-center gap-2", className)}>
                    <CreditCard className="h-4 w-4" />
                    Importar Fatura
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Importar Fatura de Cartão de Crédito</DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                                <Upload className="w-12 h-12 text-slate-300 mb-4" />
                                <h3 className="text-sm font-semibold mb-1">Upload do CSV da Fatura</h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    O CSV deve conter as colunas: <strong>title, amount, date</strong> (ou descricao, valor, data).
                                    <br />Para parcelamentos, adicione: <strong>total_installments, current_installment, installment_group</strong>.
                                </p>
                                <Input
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="max-w-xs"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="invoiceDescription">Descrição da Fatura</Label>
                                <Input
                                    id="invoiceDescription"
                                    value={invoiceDescription}
                                    onChange={(e) => setInvoiceDescription(e.target.value)}
                                    placeholder="Ex: Fatura Nubank Junho/2024"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Instituição (Bandeira)</Label>
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
                                <div className="space-y-2">
                                    <Label>Data de Vencimento da Fatura</Label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Meio de Pagamento</Label>
                                    <Combobox
                                        options={paymentMethods.map(pm => ({ value: pm.id, label: pm.nome }))}
                                        value={paymentMethodId === "none" ? "" : paymentMethodId}
                                        onValueChange={setPaymentMethodId}
                                        onAdd={handlePaymentMethodAdd}
                                        placeholder="Selecione o meio..."
                                        searchPlaceholder="Buscar ou criar..."
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                                <Repeat className="w-5 h-5 text-indigo-500" />
                                <div className="flex-1">
                                    <Label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                        Reconciliação Inteligente
                                    </Label>
                                    <p className="text-xs text-indigo-500/70">
                                        Ative para buscar provisões existentes e vincular automaticamente aos itens desta fatura.
                                    </p>
                                </div>
                                <Switch
                                    checked={isReconciliation}
                                    onCheckedChange={setIsReconciliation}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span>Revisão dos Itens da Fatura</span>
                                <div className="flex items-center gap-4">
                                    {isReconciliation && (
                                        <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-full">
                                            <Repeat className="w-3 h-3" />
                                            Reconciliação ativa
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">{parsedData.length} itens</span>
                                    <span className="font-black text-rose-600">{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold">Item</TableHead>
                                            <TableHead className="font-bold">Valor</TableHead>
                                            <TableHead className="font-bold">Data</TableHead>
                                            <TableHead className="font-bold">Categoria</TableHead>
                                            <TableHead className="font-bold">Parcelado</TableHead>
                                            <TableHead className="font-bold w-[100px]">Parcela</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.map((row) => (
                                            <TableRow key={row.id} className={row.isInstallment ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                                                <TableCell className="p-2">
                                                    <Input
                                                        value={row.title}
                                                        onChange={(e) => handleRowChange(row.id, "title", e.target.value)}
                                                        className="h-8 text-sm"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={Math.abs(row.amount)}
                                                        onChange={(e) => handleRowChange(row.id, "amount", parseFloat(e.target.value))}
                                                        className="h-8 text-sm w-[100px]"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input
                                                        type="date"
                                                        value={row.date}
                                                        onChange={(e) => handleRowChange(row.id, "date", e.target.value)}
                                                        className="h-8 text-sm w-[140px]"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Select
                                                        value={row.category_id}
                                                        onValueChange={(val) => {
                                                            if (val === "NEW") {
                                                                const catName = prompt("Nome da nova categoria (Saída):");
                                                                if (catName) handleCategoryCreate(row.id, catName);
                                                            } else {
                                                                handleRowChange(row.id, "category_id", val);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 text-sm">
                                                            <SelectValue placeholder="Categoria..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories
                                                                .filter((c: any) => c.tipo === "SAIDA")
                                                                .map((c: any) => (
                                                                    <SelectItem key={c.id} value={c.id}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />
                                                                            {c.nome}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            <SelectItem value="NEW" className="font-bold text-blue-600">+ Nova Categoria</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="p-2 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <Switch
                                                            checked={row.isInstallment}
                                                            onCheckedChange={(checked) => {
                                                                handleRowChange(row.id, "isInstallment", checked);
                                                                if (checked && !row.totalInstallments) {
                                                                    handleRowChange(row.id, "totalInstallments", 2);
                                                                    handleRowChange(row.id, "currentInstallment", 1);
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    {row.isInstallment ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={120}
                                                                value={row.currentInstallment}
                                                                onChange={(e) => handleRowChange(row.id, "currentInstallment", parseInt(e.target.value) || 1)}
                                                                className="h-8 text-sm w-[40px] text-center px-1"
                                                            />
                                                            <span className="text-xs text-muted-foreground">/</span>
                                                            <Input
                                                                type="number"
                                                                min={2}
                                                                max={120}
                                                                value={row.totalInstallments}
                                                                onChange={(e) => handleRowChange(row.id, "totalInstallments", parseInt(e.target.value) || 2)}
                                                                className="h-8 text-sm w-[40px] text-center px-1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="p-2 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                        onClick={() => setParsedData(prev => prev.filter(r => r.id !== row.id))}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-auto border-t flex justify-end gap-2 shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    {step === 1 ? (
                        <Button onClick={handleContinue} disabled={isLoading || !file || !dueDate || !invoiceDescription.trim()}>
                            Próximo <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isLoading || parsedData.some(r => !r.category_id)}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                `Importar Fatura (${formatCurrency(totalAmount)})`
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
