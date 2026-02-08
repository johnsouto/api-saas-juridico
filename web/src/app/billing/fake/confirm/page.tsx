import { Suspense } from "react";

import FakeCheckoutConfirmUI from "./ui";

export default function FakeCheckoutConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="theme-premium min-h-screen bg-background text-foreground">
          <div className="mx-auto max-w-4xl p-6 text-sm text-white/70">Carregando…</div>
        </main>
      }
    >
      <FakeCheckoutConfirmUI />
    </Suspense>
  );
}

