import "./globals.css";

import type { Metadata } from "next";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  // Needed so Next resolves Open Graph/Twitter image URLs correctly in production.
  // Without this, Next may fall back to http://localhost:3000 and previews break on WhatsApp/Telegram.
  metadataBase: new URL("https://elementojuris.cloud"),
  title: "Elemento Juris",
  description: "SaaS Jurídico multi-tenant para escritórios de advocacia",
  icons: {
    icon: [
      {
        url: "/images/favicon_google.png",
        sizes: "96x96",
        type: "image/png"
      },
      {
        url: "/favicon.ico",
        sizes: "any"
      },
      { url: "/images/favicon.png" }
    ],
    shortcut: "/images/favicon_google.png",
    apple: "/images/favicon_google.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/favicon_google.png" sizes="96x96" type="image/png" />
        <link rel="shortcut icon" href="/images/favicon_google.png" />
        {/* Theme (dark/light) - apply before paint to avoid flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var key = "ej_theme";
    var theme = localStorage.getItem(key);
    if (theme !== "light" && theme !== "dark") theme = "dark";
    var root = document.documentElement;
    if (theme === "dark") root.classList.add("theme-premium");
    else root.classList.remove("theme-premium");
  } catch (e) {}
})();`.trim()
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
