// Conta do usuário: alterar senha (BL-042) e cadastro aberto ou fechado (BL-043).
// NÃO é "use server": as Server Actions resolvem o usuário pela sessão e delegam pra cá.
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations";
import { verifyCurrentPassword } from "@/lib/services/authenticate";

export const PASSWORD_HASH_ROUNDS = 10;

// Cadastro de novos usuários só com ALLOW_REGISTRATION=true. Fechado por padrão:
// o app é pessoal, e em produção o cadastro aberto deixava qualquer um criar
// conta e descobrir quais e-mails já têm ("E-mail já cadastrado").
export function isRegistrationOpen(): boolean {
    return process.env.ALLOW_REGISTRATION === "true";
}

// Sessões já abertas (JWT) continuam válidas até expirar; a senha nova vale nos próximos logins.
export async function changePasswordForUser(userId: string, input: ChangePasswordInput): Promise<void> {
    const { currentPassword, newPassword } = changePasswordSchema.parse(input);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, password: true } });
    await verifyCurrentPassword(user, currentPassword);

    await db.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS) } });
}
