import { Suspense } from "react";

import AcceptInviteClient from "./ui";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <div className="rounded-md border border-border/20 bg-card/40 p-4 text-sm text-muted-foreground">
            Carregando…
          </div>
        </main>
      }
    >
      <AcceptInviteClient />
    </Suspense>
  );
}
