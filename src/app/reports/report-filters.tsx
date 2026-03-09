"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface ReportFiltersProps {
    statusFilter: string;
    categoryFilter: string;
    categories: any[];
}

export function ReportFilters({ statusFilter, categoryFilter, categories }: ReportFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const updateParams = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.push(`?${params.toString()}`);
    };

    return (
        <>
            <Select value={statusFilter} onValueChange={(v) => updateParams("status", v)}>
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
            <Select value={categoryFilter} onValueChange={(v) => updateParams("category", v)}>
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
        </>
    );
}
