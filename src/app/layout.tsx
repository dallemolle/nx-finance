import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
    title: "Nx Finance",
    description: "Personal Finance Control",
    icons: {
        icon: "/logo_app_nxfinance.ico",
    },
};

import { EnvironmentBanner } from "@/components/environment-banner";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className="font-sans antialiased flex flex-col min-h-screen">
                <Providers>
                    <EnvironmentBanner />
                    {children}
                    <Toaster richColors position="top-right" />
                </Providers>
            </body>
        </html>
    );
}
