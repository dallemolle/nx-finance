"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Settings, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/command-palette";

export function TopNav() {
    const pathname = usePathname();

    return (
        <nav className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">

                {/* Home Link */}
                <div className="flex items-center">
                    <Link href="/" className="font-semibold text-sm tracking-tight hover:text-foreground/80 transition-colors">
                        Nx Finance
                    </Link>
                </div>

                {/* Search trigger */}
                <div className="flex-1 flex justify-center px-4">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
                        className="flex items-center gap-2 h-9 w-full max-w-xs px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-muted/40 text-muted-foreground text-sm hover:bg-muted/70 transition-colors"
                    >
                        <Search className="h-4 w-4" />
                        <span className="hidden sm:inline-block">Buscar transações...</span>
                        <span className="hidden sm:inline-block ml-auto text-[10px] font-semibold border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5">Ctrl+K</span>
                    </button>
                </div>

                {/* Primary Nav Links */}
                <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                    <Link href="/">
                        <Button
                            variant={pathname === "/" ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-9 transition-colors gap-2",
                                pathname === "/"
                                    ? "bg-slate-100 text-slate-900 border-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
                                    : "text-muted-foreground"
                            )}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span className="hidden sm:inline-block">Dashboard</span>
                        </Button>
                    </Link>

                    <Link href="/reports">
                        <Button
                            variant={pathname.startsWith("/reports") ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-9 transition-colors gap-2",
                                pathname.startsWith("/reports")
                                    ? "bg-slate-100 text-slate-900 border-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
                                    : "text-muted-foreground"
                            )}
                        >
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline-block">Relatórios</span>
                        </Button>
                    </Link>

                    <Link href="/dashboard/settings">
                        <Button
                            variant={pathname.startsWith("/dashboard/settings") ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-9 transition-colors gap-2",
                                pathname.startsWith("/dashboard/settings")
                                    ? "bg-slate-100 text-slate-900 border-none hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline-block">Configurações</span>
                        </Button>
                    </Link>
                </div>

            </div>
        </nav>
    );
}
