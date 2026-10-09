import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Única fonte do userId pros Server Actions: sempre a sessão, nunca um
// parâmetro vindo do chamador (ver server-actions-guard.test.ts).
export async function getSessionUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Não autorizado");
    return session.user.id;
}
