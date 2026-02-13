"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
