"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreditCard, Upload, ChevronRight, X, AlertCircle, Loader2, Repeat } from "lucide-react";
import Papa from "papaparse";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { importCreditCardInvoice } from "@/lib/credit-card-actions";
import { getCreditCards } from "@/lib/credit-card-provision-actions";
import { getMappingSuggestions } from "@/lib/csv-actions";
import { getMerchantSignature } from "@/lib/dashboard-utils";
import { cn, getErrorMessage } from "@/lib/utils";
import { createCategory, createPaymentMethod } from "@/lib/actions";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import type { Category, PaymentMethod, FinancialInstitution, CreditCardDisplay } from "@/types/models";

interface ParsedInvoiceRow {
    id: number;
    title: string;
    amount: number;
    date: string;
    category_id: string;
    matchedByHistory: boolean;
    isInstallment: boolean;
    installmentNumber: number;
    installmentsCount: number;
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
    const [creditCardId, setCreditCardId] = useState<string>("none");

    // Data
    const [categories, setCategories] = useState<Category[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [institutions, setInstitutions] = useState<FinancialInstitution[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCardDisplay[]>([]);
    const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof getMappingSuggestions>>>([]);

    const [parsedData, setParsedData] = useState<ParsedInvoiceRow[]>([]);
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
            setCreditCardId("none");
            setParsedData([]);
            setError(null);

            getCategories(userId).then(setCategories);
            getPaymentMethods(userId).then(setPaymentMethods);
            getFinancialInstitutions(userId).then(setInstitutions);
            getCreditCards(userId).then(setCreditCards);
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
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const mapped = results.data.map((row, index): ParsedInvoiceRow => {
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

                        const signature = getMerchantSignature(title);
                        const guess = suggestions.find(s => s.search_term === signature);

                        return {
                            id: index,
                            title: title,
                            amount: isNaN(amount) ? 0 : amount,
                            date: date,
                            category_id: guess ? guess.categoria_id : "",
                            matchedByHistory: !!guess,
                            isInstallment: false,
                            installmentNumber: 1,
                            installmentsCount: 2,
                        };
                    });

                    setParsedData(mapped);
                    setStep(2);
                    setError(null);
                } catch {
                    setError("Erro ao processar CSV. Verifique o formato das colunas (title, amount, date).");
                } finally {
                    setIsLoading(false);
                }
            },
            error: (err: Error) => {
                setError(err.message);
                setIsLoading(false);
            }
        });
    };

    const handleRowChange = <K extends keyof ParsedInvoiceRow>(id: number, field: K, value: ParsedInvoiceRow[K]) => {
        setParsedData(prev => prev.map(row => row.id === id
            ? { ...row, [field]: value, ...(field === "category_id" ? { matchedByHistory: false } : {}) }
            : row
        ));
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
        } catch (e: unknown) {
            console.error(e);
            toast.error(getErrorMessage(e, "Erro ao criar categoria"));
        }
    };

    const handlePaymentMethodAdd = async (name: string) => {
        try {
            const newPM = await createPaymentMethod({ nome: name });
            setPaymentMethods(prev => [...prev, newPM]);
            setPaymentMethodId(newPM.id);
        } catch (e: unknown) {
            console.error(e);
            toast.error(getErrorMessage(e, "Erro ao criar meio de pagamento"));
        }
    };

    const handleSubmit = async () => {
        const hasMissingCategories = parsedData.some(r => !r.category_id);
        if (hasMissingCategories) {
            setError("Atribua uma categoria para todos os itens antes de confirmar.");
            return;
        }

        const hasInvalidInstallments = parsedData.some(
            r => r.isInstallment && (!r.installmentsCount || r.installmentNumber > r.installmentsCount)
        );
        if (hasInvalidInstallments) {
            setError("Corrija o número de parcelas dos itens marcados como parcelados.");
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
                credit_card_id: creditCardId === "none" ? null : creditCardId,
                items: parsedData.map(row => ({
                    descricao: row.title,
                    valor: row.amount,
                    categoria_id: row.category_id,
                    data_compra: row.date,
                    isInstallment: row.isInstallment,
                    installmentNumber: row.isInstallment ? row.installmentNumber : null,
                    installmentsCount: row.isInstallment ? row.installmentsCount : null,
                })),
            });

            if (result.success) {
                setOpen(false);
                router.refresh();
            }
        } catch (e: unknown) {
            setError(getErrorMessage(e, "Erro ao importar fatura"));
        } finally {
            setIsLoading(false);
        }
    };

    // Itens negativos (estorno/reembolso) reduzem o total
    const totalAmount = parsedData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
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
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Importar Fatura de Cartão de Crédito</DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 text-sm font-medium">
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

                            <div className="space-y-2">
                                <Label>Cartão de Crédito (opcional)</Label>
                                <Combobox
                                    options={creditCards.map(c => ({ value: c.id, label: c.nome }))}
                                    value={creditCardId === "none" ? "" : creditCardId}
                                    onValueChange={(v) => setCreditCardId(v || "none")}
                                    placeholder="Nenhum..."
                                    searchPlaceholder="Procurar cartão..."
                                    emptyMessage="Nenhum cartão cadastrado."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Vincular a um cartão habilita a conciliação com faturas projetadas e a marcação de itens parcelados na revisão.
                                </p>
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
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold">Item</TableHead>
                                            <TableHead className="font-bold">Valor</TableHead>
                                            <TableHead className="font-bold">Data</TableHead>
                                            <TableHead className="font-bold">Categoria</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            value={row.title}
                                                            onChange={(e) => handleRowChange(row.id, "title", e.target.value)}
                                                            className={cn("h-8 text-sm min-w-[200px]", row.isInstallment && "bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900")}
                                                        />
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={creditCardId === "none"}
                                                                    title={creditCardId === "none" ? "Selecione um cartão no passo anterior para marcar parcelamento" : "Marcar como compra parcelada"}
                                                                    className={cn("h-8 w-8 shrink-0", row.isInstallment ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")}
                                                                >
                                                                    <Repeat className="w-4 h-4" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 space-y-3" align="start">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-xs font-semibold">Compra parcelada</Label>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={row.isInstallment ? "secondary" : "outline"}
                                                                        className="h-7 text-xs"
                                                                        onClick={() => handleRowChange(row.id, "isInstallment", !row.isInstallment)}
                                                                    >
                                                                        {row.isInstallment ? "Ativado" : "Ativar"}
                                                                    </Button>
                                                                </div>
                                                                {row.isInstallment && (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[10px] text-muted-foreground">Esta é a parcela nº</Label>
                                                                            <Input
                                                                                type="number"
                                                                                min={1}
                                                                                value={row.installmentNumber}
                                                                                onChange={(e) => handleRowChange(row.id, "installmentNumber", Math.max(1, parseInt(e.target.value) || 1))}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[10px] text-muted-foreground">De quantas parcelas</Label>
                                                                            <Input
                                                                                type="number"
                                                                                min={2}
                                                                                max={48}
                                                                                value={row.installmentsCount}
                                                                                onChange={(e) => handleRowChange(row.id, "installmentsCount", Math.max(2, parseInt(e.target.value) || 2))}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                        <p className="col-span-2 text-[10px] text-muted-foreground leading-tight">
                                                                            As parcelas restantes serão projetadas nas próximas faturas, com o mesmo valor desta.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        title="Valores negativos representam estorno/reembolso e reduzem o total da fatura"
                                                        value={row.amount}
                                                        onChange={(e) => handleRowChange(row.id, "amount", parseFloat(e.target.value))}
                                                        className="h-8 text-sm w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                                        <SelectTrigger
                                                            title={row.matchedByHistory ? "Categoria sugerida com base no histórico" : undefined}
                                                            className={cn(
                                                                "h-8 text-sm",
                                                                row.matchedByHistory && "bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900"
                                                            )}
                                                        >
                                                            <SelectValue placeholder="Categoria..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories
                                                                .filter((c) => c.tipo === "SAIDA")
                                                                .map((c) => (
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
