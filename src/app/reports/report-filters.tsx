"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { cn } from "@/lib/utils";

interface ReportFiltersProps {
    statusFilter: string;
    onStatusChange: (v: string) => void;
    categoryFilter: string;
    onCategoryChange: (v: string) => void;
    institutionFilter: string;
    onInstitutionChange: (v: string) => void;
    paymentMethodFilter: string;
    onPaymentMethodChange: (v: string) => void;
    categories: any[];
    institutions: any[];
    paymentMethods: any[];
    paymentMethodTotals: Record<string, number>;
}

export function ReportFilters({ 
    statusFilter, onStatusChange, 
    categoryFilter, onCategoryChange, 
    institutionFilter, onInstitutionChange,
    paymentMethodFilter, onPaymentMethodChange,
    categories, institutions, paymentMethods, paymentMethodTotals
}: ReportFiltersProps) {

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
        }).format(val);
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="w-[130px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todo Status</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="ATRASADO">Atrasado</SelectItem>
                </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={onCategoryChange}>
                <SelectTrigger className="w-[160px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todas Categorias</SelectItem>
                    {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={institutionFilter} onValueChange={onInstitutionChange}>
                <SelectTrigger className="w-[160px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Instituição" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todas Instituições</SelectItem>
                    {institutions.map(inst => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={paymentMethodFilter} onValueChange={onPaymentMethodChange}>
                <SelectTrigger className="w-auto min-w-[200px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Meio de Pagamento" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Todos Meios</SelectItem>
                    {paymentMethods.map(pm => {
                        const total = paymentMethodTotals[pm.id] || 0;
                        return (
                            <SelectItem key={pm.id} value={pm.id}>
                                <div className="flex items-center justify-between gap-4 w-full">
                                    <span className="truncate">{pm.nome}</span>
                                    <span className={cn(
                                        "font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-muted/80",
                                        total > 0 ? "text-emerald-600" : total < 0 ? "text-rose-600" : "text-slate-500"
                                    )}>
                                        {formatCurrency(total)}
                                    </span>
                                </div>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}
