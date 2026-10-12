import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { verifySecondFactor } from "@/lib/services/two-factor";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Senha", type: "password" },
                code: { label: "Código 2FA ou de recuperação", type: "text" },
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
                    // Código do app ou de recuperação (uso único) — BL-021.
                    if (!(await verifySecondFactor(user, credentials.code))) {
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
