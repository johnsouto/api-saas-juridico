export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">SaaS Jurídico</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Monorepo (Next.js + FastAPI) rodando via Traefik.
      </p>
      <a className="mt-4 inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/login">
        Ir para login
      </a>
    </main>
  );
}
