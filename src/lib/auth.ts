import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { verify } from "otplib";

// Tolerância de 1 time-step (30s) pra frente e pra trás, absorvendo pequeno
// drift de relógio entre o servidor e o app autenticador do usuário.
const EPOCH_TOLERANCE = 30;

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Senha", type: "password" },
                code: { label: "Código 2FA", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await db.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !(await bcrypt.compare(credentials.password, user.password))) {
                    throw new Error("Credenciais inválidas");
                }

                if (user.status_2fa) {
                    if (!credentials.code) {
                        throw new Error("2FA_REQUIRED");
                    }
                    const result = await verify({
                        secret: user.secret_2fa!,
                        token: credentials.code,
                        epochTolerance: EPOCH_TOLERANCE,
                    });
                    if (!result.valid) {
                        throw new Error("Código de verificação inválido");
                    }
                }

                return {
                    id: user.id,
                    email: user.email,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        }
    },
    pages: {
        signIn: "/auth/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
};
