"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MonthPickerProps {
    month: number;
    year: number;
}

export function MonthPicker({ month, year }: MonthPickerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const updateParams = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.push(`?${params.toString()}`);
    };

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
    }));

    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    return (
        <div className="flex items-center gap-2">
            <Select value={month.toString()} onValueChange={(v) => updateParams("month", v)}>
                <SelectTrigger className="w-[140px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                    {months.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()} className="capitalize">
                            {m.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={year.toString()} onValueChange={(v) => updateParams("year", v)}>
                <SelectTrigger className="w-[100px] border-none bg-muted/50 font-medium">
                    <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                    {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
