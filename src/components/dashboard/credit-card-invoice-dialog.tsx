"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreditCard, Upload, ChevronLeft, ChevronRight, X, AlertCircle, Loader2, Repeat, FileText } from "lucide-react";
import Papa from "papaparse";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { importCreditCardInvoice, findPossibleDuplicateInstallments } from "@/lib/credit-card-actions";
import { getCreditCards } from "@/lib/credit-card-provision-actions";
import { getMappingSuggestions } from "@/lib/csv-actions";
import { getMerchantSignature, detectInstallmentInDescription } from "@/lib/dashboard-utils";
import {
    applyCategory,
    applyCategoryToUncategorized,
    buildInvoiceDefaults,
    installmentShortcut,
    missingStepOneFields,
    parseInvoiceAmount,
    parseInvoiceDate,
} from "@/lib/invoice-import";
import { cn, getErrorMessage } from "@/lib/utils";
import { createCategory, createPaymentMethod } from "@/lib/actions";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import type { Category, PaymentMethod, FinancialInstitution, CreditCardDisplay } from "@/types/models";

interface ParsedInvoiceRow {
    id: number;
    title: string;
    amount: number;
    // Texto do campo de valor enquanto o usuário digita ("245,90"); o número
    // de verdade fica em amount.
    amountInput: string;
    date: string;
    category_id: string;
    matchedByHistory: boolean;
    isInstallment: boolean;
    installmentNumber: number;
    installmentsCount: number;
}

const formatAmountInput = (value: number) =>
    new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export function CreditCardInvoiceDialog({ userId, className }: { userId: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [file, setFile] = useState<File | null>(null);
    // Arquivo que gerou os itens da revisão: voltar e avançar de novo sem
    // trocar o arquivo preserva o que já foi editado na revisão.
    const [parsedFile, setParsedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Header config
    const [invoiceDescription, setInvoiceDescription] = useState("");
    // Última descrição sugerida a partir do cartão: só é trocada ao mudar de
    // cartão se o usuário não a editou.
    const autoDescriptionRef = useRef("");
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

    // Formulário limpo a cada abertura: feito no evento de abrir (não num
    // effect), pra não disparar uma segunda renderização em cascata.
    const handleOpenChange = (next: boolean) => {
        if (next) {
            setStep(1);
            setFile(null);
            setParsedFile(null);
            setIsDragging(false);
            setInvoiceDescription("");
            autoDescriptionRef.current = "";
            setDueDate("");
            setPaymentMethodId("none");
            setInstitutionId("");
            setCreditCardId("none");
            setParsedData([]);
            setError(null);
        }
        setOpen(next);
    };

    useEffect(() => {
        if (open) {
            getCategories().then(setCategories);
            getPaymentMethods().then(setPaymentMethods);
            getFinancialInstitutions().then(setInstitutions);
            getCreditCards().then(setCreditCards);
            getMappingSuggestions().then(setSuggestions).catch(console.error);
        }
    }, [open, userId]);

    const selectFile = (selected: File | undefined) => {
        if (!selected) return;
        if (!/\.csv$/i.test(selected.name)) {
            setError("O arquivo precisa ser um CSV (.csv).");
            return;
        }
        setFile(selected);
        setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        selectFile(e.target.files?.[0]);
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
        selectFile(e.dataTransfer.files?.[0]);
    };

    // Escolher o cartão preenche instituição, vencimento, meio de pagamento e
    // uma descrição sugerida — tudo continua editável.
    const handleCardChange = (value: string) => {
        const id = value || "none";
        setCreditCardId(id);
        const card = creditCards.find(c => c.id === id);
        if (!card) return;

        const defaults = buildInvoiceDefaults({ card, paymentMethods, today: new Date() });
        setInstitutionId(defaults.institutionId);
        setDueDate(defaults.dueDate);
        if (defaults.paymentMethodId) setPaymentMethodId(defaults.paymentMethodId);
        if (!invoiceDescription.trim() || invoiceDescription === autoDescriptionRef.current) {
            setInvoiceDescription(defaults.description);
        }
        autoDescriptionRef.current = defaults.description;
    };

    const missingFields = missingStepOneFields({
        hasFile: !!file,
        description: invoiceDescription,
        dueDate,
        institutionId,
        paymentMethodId,
    });

    const handleContinue = () => {
        if (!file || missingFields.length > 0) {
            setError(`Preencha: ${missingFields.join(", ")}.`);
            return;
        }

        // Voltou da revisão sem trocar de arquivo: mantém o que já foi editado.
        if (file === parsedFile && parsedData.length > 0) {
            setStep(2);
            setError(null);
            return;
        }

        setIsLoading(true);
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const today = new Date();
                    const mapped = results.data.map((row, index): ParsedInvoiceRow => {
                        const title = row.title || row.descricao || row.description || row.Title || Object.values(row)[0] || "Sem título";
                        const amount = parseInvoiceAmount(row.amount || row.valor || row.Value || row.Amount || "0");
                        const date = parseInvoiceDate(row.date || row.data || row.Date || row.Data || row.data_compra || "", today);

                        const signature = getMerchantSignature(title);
                        const guess = suggestions.find(s => s.search_term === signature);

                        return {
                            id: index,
                            title: title,
                            amount,
                            amountInput: formatAmountInput(amount),
                            date: date,
                            category_id: guess ? guess.categoria_id : "",
                            matchedByHistory: !!guess,
                            isInstallment: false,
                            installmentNumber: 1,
                            installmentsCount: 2,
                        };
                    });

                    setParsedData(mapped);
                    setParsedFile(file);
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
        setParsedData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleAmountChange = (id: number, text: string) => {
        setParsedData(prev => prev.map(row => row.id === id
            ? { ...row, amountInput: text, amount: parseInvoiceAmount(text) }
            : row
        ));
    };

    // Escolher a categoria de um item repete a escolha nos outros itens sem
    // categoria do mesmo estabelecimento (ex.: várias corridas de Uber).
    const handleCategoryChange = (id: number, categoryId: string) => {
        setParsedData(prev => applyCategory(prev, id, categoryId)
            .map(r => r.id === id ? { ...r, matchedByHistory: false } : r));
    };

    // Parcela marcada num número > 1 pode já ter sido provisionada numa
    // importação anterior (reimportação acidental) — avisa no momento em que o
    // número é definido (ativação ou edição manual), não só ao confirmar a
    // fatura inteira. Só uma rede de segurança de UX: se a checagem falhar,
    // deixa passar (não bloqueia o usuário por causa de um erro de rede).
    const checkAndConfirmDuplicate = async (row: ParsedInvoiceRow, installmentNumber: number, installmentsCount: number) => {
        if (creditCardId === "none" || installmentNumber <= 1) return true;
        try {
            const matches = await findPossibleDuplicateInstallments(creditCardId, [
                { idx: row.id, descricao: row.title, installmentNumber, installmentsCount },
            ]);
            if (matches.length === 0) return true;
            const match = matches[0];
            return confirm(
                `A despesa "${row.title}" (parcela ${installmentNumber}/${installmentsCount}) pode já ter sido lançada antes (encontramos "${match.matchDescricao}" em ${new Date(match.matchDate).toLocaleDateString("pt-BR")}). Deseja mesmo assim gerar esta parcela e projetar as parcelas futuras?`
            );
        } catch (e: unknown) {
            console.error("Error checking possible duplicate installments:", e);
            return true;
        }
    };

    // Ativa/desativa o parcelamento manualmente. Só ao ATIVAR, tenta reconhecer
    // "Parcela 1/3", "1-5", "1 de 5" etc. no título pra pré-preencher os campos
    // — nunca ativa sozinho, e nunca altera o texto da descrição. Se a parcela
    // resultante for nº > 1, confirma possível duplicidade antes de ativar.
    const handleToggleInstallment = async (row: ParsedInvoiceRow) => {
        if (row.isInstallment) {
            handleRowChange(row.id, "isInstallment", false);
            return;
        }
        const detected = detectInstallmentInDescription(row.title);
        const number = detected?.number ?? row.installmentNumber;
        const total = detected?.total ?? row.installmentsCount;

        const ok = await checkAndConfirmDuplicate(row, number, total);
        if (!ok) return;

        setParsedData(prev => prev.map(r => r.id === row.id
            ? { ...r, isInstallment: true, installmentNumber: number, installmentsCount: total }
            : r
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
            handleCategoryChange(id, newCat.id);
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

    const uncategorizedCount = parsedData.filter(r => !r.category_id).length;

    const handleSubmit = async () => {
        if (uncategorizedCount > 0) {
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
    const saidaCategories = categories.filter((c) => c.tipo === "SAIDA");

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className={cn("flex items-center gap-2", className)}>
                    <CreditCard className="h-4 w-4" />
                    Importar Fatura
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[960px] h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Importar Fatura de Cartão de Crédito</DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? "Envie o CSV exportado do banco e escolha o cartão. Na próxima etapa você revisa os itens antes de importar."
                            : "Revise os itens, defina as categorias e marque as compras parceladas."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 mt-4 space-y-6">
                    {error && (
                        <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6">
                            <label
                                htmlFor="invoiceFile"
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                                    "focus-within:ring-2 focus-within:ring-ring",
                                    isDragging
                                        ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-950/30"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                )}
                            >
                                {file ? (
                                    <>
                                        <FileText className="w-10 h-10 text-indigo-500 mb-3" />
                                        <span className="text-sm font-semibold break-all">{file.name}</span>
                                        <span className="text-xs text-muted-foreground mt-1">Clique ou arraste outro arquivo para trocar</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-12 h-12 text-slate-300 mb-4" />
                                        <span className="text-sm font-semibold mb-1">Arraste o CSV da fatura aqui ou clique para escolher</span>
                                        <span className="text-xs text-muted-foreground">
                                            O CSV deve conter as colunas: <strong>title, amount, date</strong> (ou descricao, valor, data).
                                        </span>
                                    </>
                                )}
                                <input
                                    id="invoiceFile"
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="sr-only"
                                />
                            </label>

                            <div className="space-y-2">
                                <Label htmlFor="invoiceCard">Cartão de Crédito (opcional)</Label>
                                <Combobox
                                    id="invoiceCard"
                                    options={creditCards.map(c => ({ value: c.id, label: c.nome }))}
                                    value={creditCardId === "none" ? "" : creditCardId}
                                    onValueChange={handleCardChange}
                                    placeholder="Nenhum..."
                                    searchPlaceholder="Procurar cartão..."
                                    emptyMessage="Nenhum cartão cadastrado."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Escolher o cartão preenche a instituição, o vencimento e o meio de pagamento, e habilita a conciliação com as faturas projetadas e a marcação de compras parceladas.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="invoiceDescription">Descrição da Fatura</Label>
                                <Input
                                    id="invoiceDescription"
                                    value={invoiceDescription}
                                    onChange={(e) => setInvoiceDescription(e.target.value)}
                                    placeholder="Ex: Fatura Nubank Out/2026"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoiceInstitution">Instituição (Bandeira)</Label>
                                    <InstitutionCombobox
                                        id="invoiceInstitution"
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
                                    <Label htmlFor="invoiceDueDate">Data de Vencimento da Fatura</Label>
                                    <Input
                                        id="invoiceDueDate"
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="invoicePaymentMethod">Meio de Pagamento</Label>
                                    <Combobox
                                        id="invoicePaymentMethod"
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

                            {uncategorizedCount > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                                    <span>
                                        <strong>{uncategorizedCount}</strong> {uncategorizedCount === 1 ? "item sem categoria" : "itens sem categoria"}. Escolher a categoria de um item aplica aos outros do mesmo estabelecimento.
                                    </span>
                                    <Select
                                        value=""
                                        onValueChange={(val) => setParsedData(prev => applyCategoryToUncategorized(prev, val))}
                                    >
                                        <SelectTrigger aria-label="Aplicar uma categoria a todos os itens sem categoria" className="h-8 w-[240px] bg-background text-foreground">
                                            <SelectValue placeholder="Aplicar a todos sem categoria..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {saidaCategories.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.cor }} />
                                                        {c.nome}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="border rounded-lg overflow-x-auto">
                                <Table className="table-fixed">
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold w-[320px]">Item</TableHead>
                                            <TableHead className="font-bold w-[130px]">Valor</TableHead>
                                            <TableHead className="font-bold w-[150px]">Data</TableHead>
                                            <TableHead className="font-bold w-[220px]">Categoria</TableHead>
                                            <TableHead className="w-[56px] sticky right-0 bg-muted/50"><span className="sr-only">Remover</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.map((row, index) => {
                                            // Linha "candidata": descrição parece parcela N/M (não a última) e ainda
                                            // não foi ativada — só um destaque + atalho de 1 clique, nunca ativa sozinho.
                                            const candidate = !row.isInstallment && creditCardId !== "none"
                                                ? installmentShortcut(row.title)
                                                : null;
                                            const isRefund = row.amount < 0;
                                            const itemLabel = `item ${index + 1}`;
                                            return (
                                            <TableRow key={row.id}>
                                                <TableCell className="p-2">
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            aria-label={`Descrição do ${itemLabel}`}
                                                            value={row.title}
                                                            onChange={(e) => handleRowChange(row.id, "title", e.target.value)}
                                                            className={cn(
                                                                "h-8 text-sm flex-1 min-w-0",
                                                                row.isInstallment && "bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900",
                                                                candidate && "bg-sky-50/60 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900"
                                                            )}
                                                        />
                                                        {isRefund && (
                                                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 border-none px-1.5 py-0 text-[10px] font-bold tracking-tight shrink-0">
                                                                Estorno
                                                            </Badge>
                                                        )}
                                                        {row.isInstallment && (
                                                            <Badge className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 hover:bg-indigo-100 border-none px-1.5 py-0 text-[10px] font-bold tracking-tight shrink-0">
                                                                {row.installmentNumber}/{row.installmentsCount}
                                                            </Badge>
                                                        )}
                                                        {candidate && (
                                                            <button
                                                                type="button"
                                                                title={candidate.number === 1
                                                                    ? `Descrição parece a parcela 1 de ${candidate.total} — clique para ativar e projetar as parcelas seguintes`
                                                                    : `Descrição parece a parcela ${candidate.number} de ${candidate.total} — clique para ativar e projetar as que faltam (avisa se esse parcelamento já foi lançado)`}
                                                                onClick={() => handleToggleInstallment(row)}
                                                                className="shrink-0 flex items-center gap-1 rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 px-1.5 py-0.5 text-[10px] font-bold tracking-tight transition-colors"
                                                            >
                                                                {candidate.number}/{candidate.total} · Ativar
                                                            </button>
                                                        )}
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={creditCardId === "none"}
                                                                    aria-label={`Compra parcelada (${itemLabel})`}
                                                                    title={creditCardId === "none" ? "Selecione um cartão no passo anterior para marcar parcelamento" : "Marcar como compra parcelada"}
                                                                    className={cn("h-8 w-8 shrink-0", row.isInstallment ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")}
                                                                >
                                                                    <Repeat className="w-4 h-4" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 space-y-3" align="start">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-semibold">Compra parcelada</span>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant={row.isInstallment ? "secondary" : "outline"}
                                                                        className="h-7 text-xs"
                                                                        onClick={() => handleToggleInstallment(row)}
                                                                    >
                                                                        {row.isInstallment ? "Ativado" : "Ativar"}
                                                                    </Button>
                                                                </div>
                                                                {row.isInstallment && (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <Label htmlFor={`installmentNumber-${row.id}`} className="text-[10px] text-muted-foreground">Esta é a parcela nº</Label>
                                                                            <Input
                                                                                id={`installmentNumber-${row.id}`}
                                                                                type="number"
                                                                                min={1}
                                                                                value={row.installmentNumber}
                                                                                onChange={(e) => handleRowChange(row.id, "installmentNumber", Math.max(1, parseInt(e.target.value) || 1))}
                                                                                onBlur={async (e) => {
                                                                                    const num = Math.max(1, parseInt(e.target.value) || 1);
                                                                                    if (num <= 1) return;
                                                                                    const ok = await checkAndConfirmDuplicate(row, num, row.installmentsCount);
                                                                                    if (!ok) handleRowChange(row.id, "isInstallment", false);
                                                                                }}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <Label htmlFor={`installmentsCount-${row.id}`} className="text-[10px] text-muted-foreground">De quantas parcelas</Label>
                                                                            <Input
                                                                                id={`installmentsCount-${row.id}`}
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
                                                    <div className="relative w-[118px]">
                                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                                        <Input
                                                            aria-label={`Valor do ${itemLabel}`}
                                                            inputMode="decimal"
                                                            title="Valores negativos representam estorno/reembolso e reduzem o total da fatura"
                                                            value={row.amountInput}
                                                            onChange={(e) => handleAmountChange(row.id, e.target.value)}
                                                            onBlur={() => handleRowChange(row.id, "amountInput", formatAmountInput(row.amount))}
                                                            className={cn(
                                                                "h-8 text-sm pl-7 text-right tabular-nums",
                                                                isRefund && "text-emerald-700 dark:text-emerald-400 font-semibold"
                                                            )}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input
                                                        aria-label={`Data do ${itemLabel}`}
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
                                                                handleCategoryChange(row.id, val);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            aria-label={`Categoria do ${itemLabel}`}
                                                            title={row.matchedByHistory ? "Categoria sugerida com base no histórico" : undefined}
                                                            className={cn(
                                                                "h-8 text-sm",
                                                                row.matchedByHistory && "bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900",
                                                                !row.category_id && "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                                                            )}
                                                        >
                                                            <SelectValue placeholder="Categoria..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {saidaCategories.map((c) => (
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
                                                <TableCell className="p-2 text-center sticky right-0 bg-background">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Remover ${itemLabel}`}
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
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-auto border-t flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                        {step === 1
                            ? missingFields.length > 0 && <>Falta: {missingFields.join(", ")}</>
                            : uncategorizedCount > 0 && (
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                    {uncategorizedCount === 1 ? "Falta categorizar 1 item" : `Faltam categorizar ${uncategorizedCount} itens`}
                                </span>
                            )}
                    </p>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        {step === 1 ? (
                            <Button onClick={handleContinue} disabled={isLoading || missingFields.length > 0}>
                                Próximo <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => { setStep(1); setError(null); }} disabled={isLoading}>
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                                </Button>
                                <Button onClick={handleSubmit} disabled={isLoading || uncategorizedCount > 0}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Importando...
                                        </>
                                    ) : (
                                        `Importar Fatura (${formatCurrency(totalAmount)})`
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
