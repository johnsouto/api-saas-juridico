"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/platform", label: "Gestão" },
  { href: "/platform/faturamento", label: "Faturamento" }
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/platform") return pathname === "/platform";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Menu da plataforma">
      {NAV_ITEMS.map((item) => (
        <Button key={item.href} asChild size="sm" variant={isActivePath(pathname, item.href) ? "default" : "outline"}>
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
