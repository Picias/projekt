import type { ReactNode } from "react";

type ObradyTextCardProps = {
  title: string;
  children: ReactNode;
};

const scrollbarClassName =
  "max-h-[350px] overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600";

const EVENT_NEEDLES = ["głosow", "wotum", "budżet", "budżec", "powołan", "odwołan"];

function agendaPlainText(tekst: string): string {
  return tekst
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mentionsKeyEvent(text: string): boolean {
  const haystack = text.toLocaleLowerCase("pl");

  if (EVENT_NEEDLES.some((needle) => haystack.includes(needle))) {
    return true;
  }

  return haystack.includes("zmian") && haystack.includes("konstytucj");
}

function sentencesOf(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9„"])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return sentences.length > 0 ? sentences : [normalized];
}

/**
 * Z surowego porządku obrad wyciąga całe zdania albo akapity,
 * w których jest głosowanie, wotum, budżet, powołanie, odwołanie
 * albo zmiana Konstytucji.
 */
export function extractKeyEvents(tekst: string): string[] {
  const plain = agendaPlainText(tekst);

  if (!plain) {
    return [];
  }

  const paragraphs = plain
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const blocks = paragraphs.flatMap((paragraph) => {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 1) {
      return lines.flatMap(sentencesOf);
    }

    return sentencesOf(paragraph);
  });

  const seen = new Set<string>();
  const events: string[] = [];

  for (const block of blocks) {
    if (!mentionsKeyEvent(block) || seen.has(block)) {
      continue;
    }

    seen.add(block);
    events.push(block);
  }

  return events;
}

export function ObradyTekstWiersze({ tekst }: { tekst: string }) {
  const pelnyTekstObrad = tekst;

  if (!pelnyTekstObrad.trim()) {
    return null;
  }

  const events = extractKeyEvents(pelnyTekstObrad);

  return (
    <div className="mt-3">
      {events.length > 0 ? (
        <section aria-label="Najważniejsze tematy">
          <h3 className="mb-3 text-sm font-semibold text-white">Najważniejsze tematy</h3>
          <ul className="space-y-4">
            {events.map((event, index) => (
              <li
                key={`${index}-${event.slice(0, 48)}`}
                className="relative pl-5 space-y-4 text-sm leading-relaxed text-white/80 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-sejm-green before:content-['']"
              >
                {event}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <h3 className="text-white/50 text-sm uppercase tracking-wider mt-8 mb-4">
        Pełny porządek posiedzenia
      </h3>
      <div className="whitespace-pre-wrap text-white/70 text-sm leading-relaxed">
        {pelnyTekstObrad}
      </div>
    </div>
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
