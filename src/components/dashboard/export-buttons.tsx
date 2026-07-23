"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText, Table } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { TransactionDisplay } from "@/types/models";

interface ExportButtonsProps {
    transactions: TransactionDisplay[];
    month: number;
    year: number;
    className?: string;
}

function escapeCsvField(field: string): string {
    if (field.includes(";") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function ExportButtons({ transactions, month, year, className }: ExportButtonsProps) {
    const period = `${String(month).padStart(2, "0")}-${year}`;

    const handleExportCsv = () => {
        if (transactions.length === 0) {
            toast.error("Nenhuma transação para exportar neste período.");
            return;
        }

        const headers = ["Descrição", "Categoria", "Instituição", "Meio de Pagamento", "Data", "Tipo", "Status", "Valor"];
        const rows = transactions.map(t => [
            t.descricao,
            t.category?.nome ?? "",
            t.institution?.nome ?? "",
            t.paymentMethod?.nome ?? "",
            t.displayDate ?? String(t.data_vencimento),
            t.tipo,
            t.status,
            String(t.valor).replace(".", ","),
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(escapeCsvField).join(";"))
            .join("\n");

        // BOM no início garante acentuação correta ao abrir no Excel
        const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `nxfinance_transacoes_${period}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = () => {
        if (transactions.length === 0) {
            toast.error("Nenhuma transação para exportar neste período.");
            return;
        }

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
            return;
        }

        const rowsHtml = transactions
            .map(t => `
                <tr>
                    <td>${t.descricao}</td>
                    <td>${t.category?.nome ?? "-"}</td>
                    <td>${t.institution?.nome ?? "-"}</td>
                    <td>${t.displayDate ?? ""}</td>
                    <td>${t.status}</td>
                    <td style="text-align:right; color:${t.tipo === "ENTRADA" ? "#059669" : "#e11d48"}">
                        ${t.tipo === "ENTRADA" ? "+" : "-"} ${formatCurrency(Math.abs(t.valor))}
                    </td>
                </tr>
            `)
            .join("");

        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório NxFinance — ${period}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
                        h1 { font-size: 20px; margin-bottom: 4px; }
                        p { color: #64748b; margin-top: 0; margin-bottom: 20px; font-size: 13px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
                        th { background: #f1f5f9; font-weight: 700; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Transações — NxFinance</h1>
                    <p>Período: ${period} · ${transactions.length} lançamentos</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Instituição</th>
                                <th>Data</th>
                                <th>Status</th>
                                <th style="text-align:right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 h-9 border-slate-200 dark:border-slate-800 shadow-sm font-semibold", className)}>
                    <Download className="w-4 h-4" />
                    Exportar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-2xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                <DropdownMenuItem onClick={handleExportCsv} className="gap-2 py-2 cursor-pointer font-medium">
                    <Table className="w-4 h-4 text-emerald-500" />
                    CSV (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf} className="gap-2 py-2 cursor-pointer font-medium">
                    <FileText className="w-4 h-4 text-rose-500" />
                    Relatório PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
