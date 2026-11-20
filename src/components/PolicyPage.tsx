import Link from "next/link";

/** Shared layout for policy pages. Every page is a draft until a lawyer has reviewed it. */
export default function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        AI<span className="text-gold-ink">Mosaic</span>
      </Link>
      <p className="mt-8 rounded-xl border border-gold bg-gold/10 px-4 py-2.5 text-sm">
        <strong>Draft for legal review.</strong> This page has not been reviewed by a lawyer and is not yet in force.
      </p>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">{title}</h1>
      <div className="policy mt-6 space-y-4 text-[15px] leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-4 [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-ink">
        {children}
      </div>
      <nav className="mt-12 flex flex-wrap gap-5 border-t border-line pt-6 text-sm text-muted">
        <Link href="/token-policy" className="hover:text-ink">Token policy</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/refunds" className="hover:text-ink">Refunds</Link>
      </nav>
    </main>
  );
}
