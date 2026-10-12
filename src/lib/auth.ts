import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/lib/services/authenticate";
import { clientIpFromHeaders } from "@/lib/client-ip";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Senha", type: "password" },
                code: { label: "Código 2FA ou de recuperação", type: "text" },
            },
            // Senha, 2FA e limite de tentativas em services/authenticate.ts (BL-036).
            async authorize(credentials, req) {
                return authenticateCredentials(credentials ?? {}, clientIpFromHeaders(req?.headers));
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
