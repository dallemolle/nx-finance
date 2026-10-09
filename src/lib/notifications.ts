"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNotificationsForUser, type AppNotification } from "@/lib/services/notifications";

export type { AppNotification, NotificationType } from "@/lib/services/notifications";

async function getUserId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}

// Regra em services/notifications.ts (getNotificationsForUser).
export async function getNotifications(userId: string): Promise<AppNotification[]> {
    // Chamada direto de um Client Component (NotificationBell) com o userId da
    // própria sessão — confere contra a sessão real antes de consultar, pra não
    // depender só do chamador não mandar um userId alheio.
    const sessionUserId = await getUserId();
    if (sessionUserId !== userId) throw new Error("Não autorizado");

    return getNotificationsForUser(userId);
}
