"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { clearPlatformAdminSession, getPlatformSessionState, touchPlatformAdminActivity } from "@/lib/platformAuth";

const PLATFORM_LOGIN_PATH = "/platform/login";

function buildLoginPath(pathname: string, reason?: string): string {
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  if (pathname && pathname !== PLATFORM_LOGIN_PATH) params.set("next", pathname);
  const query = params.toString();
  return query ? `${PLATFORM_LOGIN_PATH}?${query}` : PLATFORM_LOGIN_PATH;
}

export function PlatformGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === PLATFORM_LOGIN_PATH;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoginRoute) {
      setReady(true);
      return;
    }

    const state = getPlatformSessionState();
    if (!state.valid) {
      clearPlatformAdminSession();
      router.replace(buildLoginPath(pathname, state.reason));
      setReady(true);
      return;
    }

    touchPlatformAdminActivity();
    setReady(true);
  }, [isLoginRoute, pathname, router]);

  useEffect(() => {
    if (isLoginRoute) return;

    let lastTouch = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastTouch < 5000) return;
      lastTouch = now;
      touchPlatformAdminActivity(now);
    };

    const check = () => {
      const state = getPlatformSessionState();
      if (!state.valid) {
        clearPlatformAdminSession();
        router.replace(buildLoginPath(pathname, state.reason));
      }
    };

    const onPlatformAuthFailed = () => {
      clearPlatformAdminSession();
      router.replace(buildLoginPath(pathname, "unauthorized"));
    };

    touch();

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousemove", touch, opts);
    window.addEventListener("keydown", touch);
    window.addEventListener("click", touch, opts);
    window.addEventListener("scroll", touch, opts);
    document.addEventListener("visibilitychange", touch);
    window.addEventListener("platformAuthFailed", onPlatformAuthFailed);

    const interval = window.setInterval(check, 30000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("mousemove", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("click", touch);
      window.removeEventListener("scroll", touch);
      document.removeEventListener("visibilitychange", touch);
      window.removeEventListener("platformAuthFailed", onPlatformAuthFailed);
    };
  }, [isLoginRoute, pathname, router]);

  if (!ready && !isLoginRoute) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Verificando sessão da plataforma...</p>
      </main>
    );
  }

  return <>{children}</>;
}
