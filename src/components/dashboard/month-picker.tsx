"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

    const handlePrevMonth = () => {
        let newMonth = month - 1;
        let newYear = year;
        if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("month", newMonth.toString());
        params.set("year", newYear.toString());
        router.push(`?${params.toString()}`);
    };

    const handleNextMonth = () => {
        let newMonth = month + 1;
        let newYear = year;
        if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("month", newMonth.toString());
        params.set("year", newYear.toString());
        router.push(`?${params.toString()}`);
    };

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
    }));

    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    return (
        <div className="flex items-center gap-1 md:gap-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-md shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={handlePrevMonth}
            >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Mês Anterior</span>
            </Button>
            
            <div className="flex items-center">
                <Select value={month.toString()} onValueChange={(v) => updateParams("month", v)}>
                    <SelectTrigger className="w-auto min-w-[70px] md:min-w-[110px] h-8 border-none bg-transparent font-medium shadow-none focus:ring-0 text-sm">
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
                    <SelectTrigger className="w-auto min-w-[50px] md:min-w-[70px] h-8 border-none bg-transparent font-medium shadow-none focus:ring-0 text-sm">
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

            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-md shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={handleNextMonth}
            >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Próximo Mês</span>
            </Button>
        </div>
    );
}
