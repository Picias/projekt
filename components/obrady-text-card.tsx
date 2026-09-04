import type { ReactNode } from "react";

import { formatujTekst } from "@/lib/formatuj-tekst";

type ObradyTextCardProps = {
  title: string;
  children: ReactNode;
};

const scrollbarClassName =
  "max-h-[350px] overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600";

export function ObradyTekstWiersze({ tekst }: { tekst: string }) {
  const wiersze = formatujTekst(tekst);

  if (wiersze.length === 0) {
    return null;
  }

  return (
    <>
      {wiersze.map((wiersz, index) => (
        <p
          key={`${index}-${wiersz.slice(0, 48)}`}
          className="mb-3 text-left text-sm leading-relaxed text-slate-300"
          dangerouslySetInnerHTML={{ __html: wiersz }}
        />
      ))}
    </>
  );
}

export default function ObradyTextCard({ title, children }: ObradyTextCardProps) {
  return (
    <section className="rounded-xl bg-slate-800/30 p-5 ring-1 ring-white/5">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </h2>
      <div className={scrollbarClassName}>{children}</div>
    </section>
  );
}
