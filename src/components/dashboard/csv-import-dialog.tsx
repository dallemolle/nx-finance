"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, ChevronRight, X, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { getCategories, getPaymentMethods, getFinancialInstitutions } from "@/lib/reports";
import { InstitutionCombobox } from "@/components/dashboard/institution-combobox";
import { processBatchTransactions, getMappingSuggestions } from "@/lib/csv-actions";
import { cn } from "@/lib/utils";
import { createCategory } from "@/lib/actions";

export function CsvImportDialog({ userId, className }: { userId: string, className?: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global Configs
    const [dueDate, setDueDate] = useState<string>("");
    const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
    const [institutionId, setInstitutionId] = useState<string>("");

    // Data
    const [categories, setCategories] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [institutions, setInstitutions] = useState<any[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const [parsedData, setParsedData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setStep(1);
            setFile(null);
            setDueDate("");
            setPaymentMethodId("none");
            setInstitutionId("");
            setParsedData([]);
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
        if (!dueDate) {
            setError("Data de vencimento global é obrigatória para o lote");
            return;
        }
        if (!institutionId) {
            setError("Selecione uma Instituição Financeira para o lote.");
            return;
        }
        if (paymentMethodId === "none") {
            setError("Selecione um Meio de Pagamento para o lote.");
            return;
        }

        setIsLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                try {
                    const mapped = results.data.map((row: any, index: number) => {
                        // Attempt to extract title, amount, date based on common headers
                        const title = row.title || row.descricao || row.description || row.Title || Object.values(row)[0] || "Sem título";
                        const rawAmount = row.amount || row.valor || row.Value || row.Amount || "0";
                        const amount = parseFloat(String(rawAmount).replace(/[R$\s]/g, '').replace(',', '.'));
                        const date = row.date || row.data || row.Date || row.Data || new Date().toISOString();

                        // Find category suggestion based on search_term
                        const guess = suggestions.find(s => title.toLowerCase().includes(s.search_term));

                        return {
                            id: index,
                            original_title: title,
                            title: title,
                            amount: isNaN(amount) ? 0 : amount,
                            date: date,
                            category_id: guess ? guess.categoria_id : "",
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
                cor: "#3b82f6", // Default blue
                icone: "Wallet",
                tipo: "SAIDA" // Default assumtion for imports
            });
            setCategories(prev => [...prev, newCat]);
            handleRowChange(id, "category_id", newCat.id);
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

        setIsLoading(true);
        setError(null);

        const payload = parsedData.map(row => ({
            descricao: row.title,
            original_title: row.original_title,
            valor: Math.abs(row.amount),
            tipo: row.amount >= 0 ? "SAIDA" : "ENTRADA", // Usually CSV amounts denote type. Let's assume positive is ENTRADA unless configured. But if amount is positive for expenses, let's treat all as SAIDA by default if it's a credit card import. Actually we'll base on amount sign if there is one. Assumed logic: if amount < 0, SAIDA. If positive, ENTRADA., 
            data_vencimento: dueDate,
            data_lancamento: new Date().toISOString(),
            status: "PENDENTE", // Usually imported statements are paid
            categoria_id: row.category_id,
            tipo_pagamento_id: paymentMethodId === "none" ? null : paymentMethodId,
            institution_id: institutionId,
        }));

        try {
            await processBatchTransactions(payload);
            setOpen(false);
            router.refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("flex items-center gap-2", className)}>
                    <Upload className="h-4 w-4" />
                    Importar CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Importar Transações</DialogTitle>
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
                                <h3 className="text-sm font-semibold mb-1">Upload do Arquivo CSV</h3>
                                <p className="text-xs text-muted-foreground mb-4">Certifique-se que o arquivo possua as colunas date, title e amount.</p>
                                <Input
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="max-w-xs"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
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
                                <div className="space-y-2">
                                    <Label>Data de Vencimento do Lote</Label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Meio de Pagamento (Opcional)</Label>
                                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um meio..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Não especificado</SelectItem>
                                            {paymentMethods.map(pm => (
                                                <SelectItem key={pm.id} value={pm.id}>{pm.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span>Revisão e Mapeamento</span>
                                <span className="text-muted-foreground">{parsedData.length} registros</span>
                            </div>
                            <div className="border rounded-lg overflow-hidden shrink-0">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Título</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.map((row) => (
                                            <TableRow key={row.id}>
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
                                                        value={row.amount}
                                                        onChange={(e) => handleRowChange(row.id, "amount", parseFloat(e.target.value))}
                                                        className="h-8 text-sm w-[100px]"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Select value={row.category_id} onValueChange={(val) => {
                                                        if (val === "NEW") {
                                                            const catName = prompt("Nome da nova categoria (Saída):");
                                                            if (catName) handleCategoryCreate(row.id, catName);
                                                        } else {
                                                            handleRowChange(row.id, "category_id", val);
                                                        }
                                                    }}>
                                                        <SelectTrigger className="h-8 text-sm">
                                                            <SelectValue placeholder="Categoria..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories.map(c => (
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
                        <Button onClick={handleContinue} disabled={isLoading || !file || !dueDate}>
                            Próximo <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isLoading || parsedData.some(r => !r.category_id)}>
                            {isLoading ? "Processando..." : "Confirmar Importação"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
