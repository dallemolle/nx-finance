"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthPickerProps {
    month: number;
    year: number;
    onMonthChange: (month: number) => void;
    onYearChange: (year: number) => void;
}

const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function MonthPicker({ month, year, onMonthChange, onYearChange }: MonthPickerProps) {
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    return (
        <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-background"
                onClick={() => {
                    if (month === 1) {
                        onMonthChange(12);
                        onYearChange(year - 1);
                    } else {
                        onMonthChange(month - 1);
                    }
                }}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 px-2">
                <Select value={month.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[110px] border-none bg-transparent hover:bg-background focus:ring-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map((m, i) => (
                            <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[80px] border-none bg-transparent hover:bg-background focus:ring-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-background"
                onClick={() => {
                    if (month === 12) {
                        onMonthChange(1);
                        onYearChange(year + 1);
                    } else {
                        onMonthChange(month + 1);
                    }
                }}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
