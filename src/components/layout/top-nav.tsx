"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TopNav() {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <nav className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">

                {/* Back Button */}
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mr-2 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={() => router.back()}
                        aria-label="Voltar"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-sm tracking-tight hidden sm:inline-block">
                        Nx Finance
                    </span>
                </div>

                {/* Primary Nav Links */}
                <div className="flex items-center gap-1 sm:gap-2">
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
