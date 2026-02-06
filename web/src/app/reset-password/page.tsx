import { Suspense } from "react";

import ResetPasswordUI from "./ui";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <Suspense fallback={<p className="text-sm text-zinc-600">Carregando…</p>}>
        <ResetPasswordUI />
      </Suspense>
    </main>
  );
}

