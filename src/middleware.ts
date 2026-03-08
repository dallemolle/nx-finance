import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth/login") ||
      req.nextUrl.pathname.startsWith("/auth/register");
    const isVerify2FAPage = req.nextUrl.pathname === "/auth/verify-2fa";

    // Se o usuário não estiver logado e tentar acessar o dashboard, o withAuth redireciona para o login

    if (isAuth) {
      if (isAuthPage) {
        return NextResponse.redirect(new URL("/", req.url));
      }

      // Se o usuário está logado mas ainda não passou pelo 2FA (segundo fator)
      const isTwoFactorVerified = token.isTwoFactorVerified;
      const needsTwoFactor = token.needsTwoFactor;

      if (needsTwoFactor && !isTwoFactorVerified && !isVerify2FAPage) {
        return NextResponse.redirect(new URL("/auth/verify-2fa", req.url));
      }
    }

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
