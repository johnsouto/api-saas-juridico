"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackEvent } from "@/lib/gtm";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  const search = searchParams.toString();
  const fullPath = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (!fullPath || lastTrackedPath.current === fullPath) return;
    lastTrackedPath.current = fullPath;

    trackEvent("ej_page_view", {
      page_path: fullPath
    });
  }, [fullPath]);

  return null;
}
