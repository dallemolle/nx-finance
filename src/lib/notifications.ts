"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addDays, endOfMonth } from "date-fns";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

export type NotificationType = "due_soon" | "overdue" | "estimate_pending" | "invoice_pending_import";

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    description: string;
    valor: number;
    date: Date;
    href: string;
}

const DUE_SOON_DAYS = 3;
const INVOICE_PENDING_IMPORT_DAYS = 7;

// Central de notificações computada sob demanda — sem tabela nova no banco,
// sem cron, sem provedor externo. Mesma filosofia do status ATRASADO em
// dashboard.ts/reports.ts (calculado na query, nunca persistido): a
// notificação "some" sozinha quando o usuário resolve a causa (paga,
// efetiva, importa a fatura), sem precisar de um estado de "lida".
export async function getNotifications(userId: string): Promise<AppNotification[]> {
    // Chamada direto de um Client Component (NotificationBell) com o userId da
    // própria sessão — confere contra a sessão real antes de consultar, pra não
    // depender só do chamador não mandar um userId alheio.
    const sessionUserId = await getUserId();
    if (sessionUserId !== userId) throw new Error("Não autorizado");

    const now = new Date();

    const [dueSoon, overdue, estimatesPending, invoicesPendingImport] = await Promise.all([
        db.transaction.findMany({
            where: {
                userId,
                is_provisioned: false,
                status: { not: "PAGO" },
                data_vencimento: { gte: now, lte: addDays(now, DUE_SOON_DAYS) },
            },
            include: { category: true },
            orderBy: { data_vencimento: "asc" },
        }),
        db.transaction.findMany({
            where: {
                userId,
                is_provisioned: false,
                status: { not: "PAGO" },
                data_vencimento: { lt: now },
            },
            include: { category: true },
            orderBy: { data_vencimento: "asc" },
        }),
        db.transaction.findMany({
            where: {
                userId,
                is_provisioned: true,
                credit_card_id: null,
                data_vencimento: { lte: endOfMonth(now) },
            },
            include: { category: true },
            orderBy: { data_vencimento: "asc" },
        }),
        db.transaction.findMany({
            where: {
                userId,
                is_invoice_header: true,
                is_provisioned: true,
                credit_card_id: { not: null },
                data_vencimento: { gte: now, lte: addDays(now, INVOICE_PENDING_IMPORT_DAYS) },
            },
            include: { creditCard: true },
            orderBy: { data_vencimento: "asc" },
        }),
    ]);

    const monthHref = (date: Date) => `/?month=${date.getMonth() + 1}&year=${date.getFullYear()}`;

    const notifications: AppNotification[] = [
        ...dueSoon.map((t): AppNotification => ({
            id: `due_soon-${t.id}`,
            type: "due_soon",
            title: t.descricao,
            description: `Vence em breve${t.category ? ` · ${t.category.nome}` : ""}`,
            valor: Number(t.valor),
            date: t.data_vencimento,
            href: monthHref(t.data_vencimento),
        })),
        ...overdue.map((t): AppNotification => ({
            id: `overdue-${t.id}`,
            type: "overdue",
            title: t.descricao,
            description: `Atrasada${t.category ? ` · ${t.category.nome}` : ""}`,
            valor: Number(t.valor),
            date: t.data_vencimento,
            href: monthHref(t.data_vencimento),
        })),
        ...estimatesPending.map((t): AppNotification => ({
            id: `estimate_pending-${t.id}`,
            type: "estimate_pending",
            title: t.descricao,
            description: `Despesa prevista ainda não efetivada${t.category ? ` · ${t.category.nome}` : ""}`,
            valor: Number(t.valor),
            date: t.data_vencimento,
            href: monthHref(t.data_vencimento),
        })),
        ...invoicesPendingImport.map((t): AppNotification => ({
            id: `invoice_pending_import-${t.id}`,
            type: "invoice_pending_import",
            title: t.creditCard?.nome ?? "Cartão",
            description: "Fatura prevista vence em breve — importe o extrato real",
            valor: Number(t.valor),
            date: t.data_vencimento,
            href: "/faturas",
        })),
    ];

    const typeOrder: Record<NotificationType, number> = {
        overdue: 0,
        due_soon: 1,
        invoice_pending_import: 1,
        estimate_pending: 2,
    };
    notifications.sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.date.getTime() - b.date.getTime());

    return notifications;
}
