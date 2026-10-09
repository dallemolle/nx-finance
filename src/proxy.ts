import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth/login") ||
      req.nextUrl.pathname.startsWith("/auth/register");

    // Se o usuário não estiver logado e tentar acessar o dashboard, o withAuth redireciona para o login

    if (isAuth && isAuthPage) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // O 2FA já é validado dentro de authorize() (auth.ts) antes do JWT
    // existir, então não há um estado "logado mas pendente de 2FA" a checar aqui.

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rotas públicas que não precisam de autenticação
        const publicRoutes = ["/auth/login", "/auth/register", "/api/auth"];
        const isPublic = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

        if (isPublic) return true;

        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/", "/dashboard/:path*", "/auth/:path*"],
};
