'use client';

import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          © {year} SuperSeller IA • Todos os direitos reservados
        </p>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/legal/privacy"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            Privacidade
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/legal/terms"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
          >
            Termos
          </Link>
        </nav>
      </div>
    </footer>
  );
}
