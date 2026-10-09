"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, AlertTriangle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotifications, type AppNotification, type NotificationType } from "@/lib/notifications";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<NotificationType, { icon: typeof Clock; className: string }> = {
    overdue: { icon: AlertTriangle, className: "text-rose-500 bg-rose-50 dark:bg-rose-950/30" },
    due_soon: { icon: Clock, className: "text-orange-500 bg-orange-50 dark:bg-orange-950/30" },
    estimate_pending: { icon: CalendarClock, className: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" },
    invoice_pending_import: { icon: CalendarClock, className: "text-amber-500 bg-amber-50 dark:bg-amber-950/30" },
};

export function NotificationBell() {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        if (userId) getNotifications(userId).then(setNotifications).catch(console.error);
    }, [userId]);

    if (!userId) return null;

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) getNotifications(userId).then(setNotifications).catch(console.error);
            }}
        >
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground">
                    <Bell className="h-4 w-4" />
                    {notifications.length > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                            {notifications.length > 9 ? "9+" : notifications.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Notificações</span>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                            <p className="text-xs text-muted-foreground">Nenhuma notificação pendente.</p>
                        </div>
                    ) : (
                        notifications.map((n) => {
                            const { icon: Icon, className } = TYPE_STYLES[n.type];
                            return (
                                <Link
                                    key={n.id}
                                    href={n.href}
                                    onClick={() => setOpen(false)}
                                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", className)}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                                {format(new Date(n.date), "dd 'de' MMM", { locale: ptBR })}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatCurrency(n.valor)}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
