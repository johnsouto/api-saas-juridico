"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Container } from "@/components/landing/Container";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  // Close menu on resize to desktop.
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0e1e2b]/80 backdrop-blur">
      <Container className="flex items-center justify-between py-3">
        <Link href="/" className={cn("flex items-center gap-2 text-white", focusRing)}>
          <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
            <Image src="/images/Logotipo.jpeg" alt="Elemento Juris" fill className="object-cover" sizes="36px" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">Elemento Juris</div>
            <div className="text-xs text-white/70">SaaS Jurídico</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:text-white hover:bg-white/5 transition-colors duration-200",
              focusRing
            )}
          >
            Login
          </Link>
          <Link
            href="/login?mode=register"
            className={cn(
              "rounded-md bg-[#234066] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(35,64,102,0.35)]",
              "hover:bg-[#234066]/90 hover:shadow-[0_0_44px_rgba(35,64,102,0.45)] transition-all duration-300",
              focusRing
            )}
          >
            Criar conta
          </Link>
        </nav>

        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white",
            "transition-colors duration-200 hover:bg-white/10",
            focusRing
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      <div
        id="landing-mobile-nav"
        className={cn(
          "md:hidden overflow-hidden border-t border-white/10 bg-[#0e1e2b]/95 backdrop-blur",
          "transition-[max-height] duration-300 ease-out motion-reduce:transition-none",
          open ? "max-h-64" : "max-h-0"
        )}
      >
        <Container className="py-3">
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/5 transition-colors duration-200",
                focusRing
              )}
            >
              Login
            </Link>
            <Link
              href="/login?mode=register"
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md bg-[#234066] px-3 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(35,64,102,0.35)]",
                "hover:bg-[#234066]/90 transition-colors duration-300",
                focusRing
              )}
            >
              Criar conta
            </Link>
            <Link
              href="#planos"
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-white/75 hover:text-white hover:bg-white/5 transition-colors duration-200",
                focusRing
              )}
            >
              Ver planos
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
