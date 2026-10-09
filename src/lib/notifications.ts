"use server";

import { getSessionUserId } from "@/lib/session";
import { getNotificationsForUser, type AppNotification } from "@/lib/services/notifications";

export type { AppNotification, NotificationType } from "@/lib/services/notifications";

// Regra em services/notifications.ts (getNotificationsForUser).
export async function getNotifications(): Promise<AppNotification[]> {
    return getNotificationsForUser(await getSessionUserId());
}
