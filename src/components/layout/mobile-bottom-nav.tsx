"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
    { href: "/reports", label: "Relatórios", icon: FileText, match: (p: string) => p.startsWith("/reports") },
    { href: "/dashboard/settings", label: "Config.", icon: Settings, match: (p: string) => p.startsWith("/dashboard/settings") },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const { status } = useSession();

    if (status !== "authenticated") return null;
    if (pathname.startsWith("/auth")) return null;

    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
                {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
                    const isActive = match(pathname);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-medium transition-colors",
                                isActive
                                    ? "text-slate-900 dark:text-slate-50"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", isActive && "text-indigo-500")} />
                            {label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
