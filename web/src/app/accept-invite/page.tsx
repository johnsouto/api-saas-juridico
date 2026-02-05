import { Suspense } from "react";

import AcceptInviteClient from "./ui";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <div className="rounded-md border bg-white p-4 text-sm text-zinc-600">Carregando…</div>
        </main>
      }
    >
      <AcceptInviteClient />
    </Suspense>
  );
}

