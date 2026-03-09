"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText, Table } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function ExportButtons() {
    const handleExport = (type: 'csv' | 'pdf') => {
        // Mock functionality for now
        alert(`Exportando para ${type.toUpperCase()}... (Recurso em desenvolvimento)`);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 border-slate-200 dark:border-slate-800 shadow-sm font-semibold">
                    <Download className="w-4 h-4" />
                    Exportar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2 py-2 cursor-pointer font-medium">
                    <Table className="w-4 h-4 text-emerald-500" />
                    CSV (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 py-2 cursor-pointer font-medium">
                    <FileText className="w-4 h-4 text-rose-500" />
                    Relatório PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
