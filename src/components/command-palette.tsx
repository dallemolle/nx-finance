"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, FileText, Settings, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { searchTransactions } from "@/lib/reports";

export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

interface TransactionResult {
    id: string;
    descricao: string;
    valor: number;
    tipo: "ENTRADA" | "SAIDA";
    data_vencimento: Date;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CommandPalette() {
    const { status } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TransactionResult[]>([]);

    useEffect(() => {
        if (status !== "authenticated") return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        const handleOpenEvent = () => setOpen(true);

        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
        };
    }, [status]);

    useEffect(() => {
        if (!query.trim()) return;
        const timeout = setTimeout(() => {
            searchTransactions(query)
                .then(setResults)
                .catch(() => setResults([]));
        }, 300);
        return () => clearTimeout(timeout);
    }, [query]);

    const navigate = useCallback((path: string) => {
        setOpen(false);
        router.push(path);
    }, [router]);

    const handleOpenChange = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) {
            setQuery("");
            setResults([]);
        }
    }, []);

    if (status !== "authenticated") return null;

    const visibleResults = query.trim() ? results : [];

    return (
        <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
            <CommandInput
                placeholder="Buscar transações ou navegar..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup heading="Navegação">
                    <CommandItem onSelect={() => navigate("/")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </CommandItem>
                    <CommandItem onSelect={() => navigate("/reports")}>
                        <FileText className="mr-2 h-4 w-4" />
                        Relatórios
                    </CommandItem>
                    <CommandItem onSelect={() => navigate("/dashboard/settings")}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configurações
                    </CommandItem>
                </CommandGroup>
                {visibleResults.length > 0 && (
                    <CommandGroup heading="Transações">
                        {visibleResults.map((t) => {
                            const date = new Date(t.data_vencimento);
                            return (
                                <CommandItem
                                    key={t.id}
                                    value={`transacao-${t.id}`}
                                    onSelect={() => navigate(`/reports?month=${date.getMonth() + 1}&year=${date.getFullYear()}`)}
                                >
                                    {t.tipo === "ENTRADA" ? (
                                        <ArrowUpCircle className="mr-2 h-4 w-4 text-emerald-500 shrink-0" />
                                    ) : (
                                        <ArrowDownCircle className="mr-2 h-4 w-4 text-rose-500 shrink-0" />
                                    )}
                                    <span className="flex-1 truncate">{t.descricao}</span>
                                    <span className="ml-2 text-xs text-muted-foreground shrink-0">{formatCurrency(t.valor)}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}
