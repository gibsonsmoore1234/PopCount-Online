import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="border-ink shadow-hard-sm mb-5 inline-flex items-center gap-1 rounded-xl border-2 bg-white px-3 py-1.5 text-xs font-extrabold"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={3} /> Back to map
      </Link>
      <article className="border-ink shadow-hard [&_p]:text-ink-2 [&_ul]:text-ink-2 rounded-2xl border-2 bg-white p-6 sm:p-8 [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:uppercase [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:font-medium [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:font-medium">
        <h1 className="text-3xl font-black tracking-tight uppercase">{title}</h1>
        <p className="!text-muted !mt-1 !text-xs !font-bold">Last updated {updated}</p>
        {children}
      </article>
    </div>
  );
}
