"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Upload, ChevronRight, X, AlertCircle, Loader2, CheckCircle2, HelpCircle } from "lucide-react";
import Papa from "papaparse";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { importCreditCardInvoice } from "@/lib/credit-card-actions";
import { getMappingSuggestions } from "@/lib/csv-actions";
import { suggestMatches } from "@/lib/matching-actions";
import { batchReconcile } from "@/lib/provision-actions";
import { cn, normalizeCsvRow, parseCsvAmount, parseCsvDate, detectCsvHeaders } from "@/lib/utils";
import { createCategory, createPaymentMethod } from "@/lib/actions";
import { Combobox } from "@/components/ui/combobox";

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

    // Data
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [institutions, setInstitutions] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const [parsedData, setParsedData] = useState<any[]>([]);
    const [matchSuggestions, setMatchSuggestions] = useState<Map<number, any[]>>(new Map());
    const [reconcileDecisions, setReconcileDecisions] = useState<Map<number, boolean>>(new Map());
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
            setMatchSuggestions(new Map());
            setReconcileDecisions(new Map());
            setError(null);

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
            header: false,
            skipEmptyLines: true,
            complete: async (results: any) => {
                try {
                    const rawRows: string[][] = Array.isArray(results?.data) ? results.data : [];
                    if (rawRows.length === 0) {
                        setError("CSV vazio. Verifique o arquivo.");
                        setIsLoading(false);
                        return;
                    }

                    const rawHeaders = (rawRows[0] || []).map((c: string) => String(c ?? "").trim());
                    const headerIndex = detectCsvHeaders(rawHeaders);
                    const dataRows = rawRows.slice(1);

                    const mapped = dataRows.map((row: any, index: number) => {
                        const { title, rawAmount, rawDate } = normalizeCsvRow(row, headerIndex);
                        const amount = parseCsvAmount(rawAmount);
                        const date = parseCsvDate(rawDate);

                        const guess = title ? suggestions.find((s: any) => title.toLowerCase().includes(s.search_term)) : undefined;

                        return {
                            id: index,
                            title: title || "Sem título",
                            amount: Math.abs(amount),
                            date: date,
                            category_id: guess ? guess.categoria_id : "",
                            totalInstallments: null as number | null,
                            currentInstallment: 1,
                            installmentInput: "1/1",
                            reconcileProvisionId: null as string | null,
                            autoMatched: false,
                        };
                    });

                    setParsedData(mapped);

                    // Fetch matching suggestions for reconciliation
                    const suggestionsRecord = await suggestMatches(
                        mapped.map((r: any) => ({ id: r.id, description: r.title, amount: r.amount })),
                        userId,
                        institutionId
                    );
                    const suggestionsMap = new Map(
                        Object.entries(suggestionsRecord).map(([k, v]) => [Number(k), v])
                    );
                    setMatchSuggestions(suggestionsMap);

                    // Auto-accept high-confidence matches and pre-fill installment info
                    const autoDecisions = new Map<number, boolean>();
                    for (const [rowId, matches] of suggestionsMap.entries()) {
                        if (matches.length > 0 && matches[0].score >= 80) {
                            autoDecisions.set(rowId, true);
                        }
                    }
                    setReconcileDecisions(autoDecisions);

                    // Pre-fill installmentInput from matched provisions
                    if (suggestionsMap.size > 0) {
                        setParsedData(prev => prev.map(row => {
                            const matches = suggestionsMap.get(row.id);
                            if (matches && matches.length > 0) {
                                const m = matches[0];
                                // Extract installment info from provision description if available
                                const descMatch = m.provisionDescription.match(/\((\d+)\/(\d+)\)$/);
                                if (descMatch) {
                                    const current = parseInt(descMatch[1], 10);
                                    const total = parseInt(descMatch[2], 10);
                                    return {
                                        ...row,
                                        totalInstallments: total,
                                        currentInstallment: current,
                                        installmentInput: `${current}/${total}`,
                                    };
                                }
                            }
                            return row;
                        }));
                    }

                    setStep(2);
                    setError(null);
                } catch (e: any) {
                    console.error("CSV parse error:", e, e?.message);
                    setError("Erro ao processar CSV. Verifique o formato: title, amount, date.");
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

    const toggleReconcile = (rowId: number) => {
        setReconcileDecisions(prev => {
            const next = new Map(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.set(rowId, true);
            }
            return next;
        });
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
            // Separate items to reconcile vs items to create new
            const itemsToCreate = parsedData.filter(r => !reconcileDecisions.has(r.id));
            const itemsToReconcile = parsedData.filter(r => reconcileDecisions.has(r.id));

            // Create the invoice with only the items that need to be created
            const result = await importCreditCardInvoice({
                descricao: invoiceDescription,
                data_vencimento: dueDate,
                institution_id: institutionId,
                tipo_pagamento_id: paymentMethodId,
                items: itemsToCreate.map(row => ({
                    descricao: row.title,
                    valor: Math.abs(row.amount),
                    categoria_id: row.category_id,
                    data_compra: row.date,
                    totalInstallments: row.totalInstallments,
                    currentInstallment: row.currentInstallment,
                })),
            });

            if (result.success) {
                // Reconcile provisioned items that the user accepted
                if (itemsToReconcile.length > 0) {
                    const invoiceId = result.data.transaction.id;
                    const decisions = itemsToReconcile.map(row => {
                        const match = matchSuggestions.get(row.id)?.[0];
                        return {
                            provisionId: match?.provisionId || row.reconcileProvisionId!,
                            type: "invoice_item" as const,
                            targetInvoiceId: invoiceId,
                        };
                    }).filter(d => d.provisionId);

                    if (decisions.length > 0) {
                        await batchReconcile(decisions);
                    }
                }

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

    const getMatchForRow = (rowId: number) => matchSuggestions.get(rowId)?.[0] || null;

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
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span>Revisão dos Itens da Fatura</span>
                                <div className="flex items-center gap-4">
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
                                            <TableHead className="font-bold w-[90px]">Parcelas</TableHead>
                                            <TableHead className="font-bold min-w-[180px]">Provisão</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.map((row) => {
                                            const match = getMatchForRow(row.id);
                                            const isReconciling = reconcileDecisions.has(row.id);

                                            return (
                                                <TableRow key={row.id} className={cn(isReconciling && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                                                <TableCell className="p-2 w-full min-w-[200px]">
                                                    <Input
                                                        value={row.title}
                                                        onChange={(e) => handleRowChange(row.id, "title", e.target.value)}
                                                        className="h-8 text-sm w-full"
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
                                                <TableCell className="p-2">
                                                    <Input
                                                        value={row.installmentInput ?? "1/1"}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            handleRowChange(row.id, "installmentInput", v);
                                                            const parts = v.split("/");
                                                            const current = parseInt(parts[0], 10);
                                                            const total = parseInt(parts[1], 10);
                                                            if (parts.length === 2 && !isNaN(current) && !isNaN(total) && total >= 1 && current >= 1 && current <= total) {
                                                                handleRowChange(row.id, "currentInstallment", current);
                                                                handleRowChange(row.id, "totalInstallments", total);
                                                            } else if (!v || v === "1/1") {
                                                                handleRowChange(row.id, "totalInstallments", null);
                                                                handleRowChange(row.id, "currentInstallment", 1);
                                                            }
                                                        }}
                                                        placeholder="1/5"
                                                        className="h-8 text-sm w-[80px] text-center"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    {match ? (
                                                            <div className="flex items-center gap-2">
                                                                <Switch
                                                                    checked={isReconciling}
                                                                    onCheckedChange={() => toggleReconcile(row.id)}
                                                                    className="data-[state=checked]:bg-emerald-500"
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className={cn(
                                                                        "text-xs font-medium flex items-center gap-1",
                                                                        isReconciling ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
                                                                    )}>
                                                                        {isReconciling ? (
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                        ) : (
                                                                            <HelpCircle className="w-3 h-3" />
                                                                        )}
                                                                        {isReconciling ? "Vinculado" : "Sugerido"}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                                                                        {match.provisionDescription}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                                                <X className="w-3 h-3" />
                                                                Nenhuma provisão
                                                            </span>
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
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            {matchSuggestions.size > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    {matchSuggestions.size} {matchSuggestions.size === 1 ? "item possui" : "itens possuem"} provisão correspondente.
                                    {reconcileDecisions.size > 0 && (
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                            {reconcileDecisions.size} selecionado{reconcileDecisions.size > 1 ? "s" : ""} para vínculo.
                                        </span>
                                    )}
                                    Ative o switch para vincular.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-auto border-t flex justify-end gap-2 shrink-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    {step === 1 ? (
                        <Button onClick={handleContinue} disabled={isLoading || !file || !dueDate || !invoiceDescription.trim()}>
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                            ) : (
                                <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>
                            )}
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
