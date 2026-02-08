import "./globals.css";

import type { Metadata } from "next";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "SaaS Jurídico",
  description: "SaaS Jurídico multi-tenant para escritórios de advocacia"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
