import { plainTitle, titleSizeClass, type TitleScale } from "@/lib/legislative-title";

type LegislativeTitleProps = {
  title: string;
  as?: "h1" | "h2" | "h3" | "p";
  scale?: TitleScale;
  /** Pod nagłówkiem pokaż rozwijany tytuł oficjalny, gdy różni się od uproszczonego. */
  showOfficial?: boolean;
  id?: string;
  className?: string;
};

export default function LegislativeTitle({
  title,
  as: Tag = "h2",
  scale = "card",
  showOfficial = false,
  id,
  className = "",
}: LegislativeTitleProps) {
  const plain = plainTitle(title);
  const differs = plain !== title.replace(/\s+/g, " ").trim();

  return (
    <>
      <Tag id={id} className={`${titleSizeClass(plain, scale)} ${className}`}>
        {plain}
      </Tag>
      {showOfficial && differs ? (
        <details className="group mt-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
          <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-white/80 marker:hidden hover:text-white">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            Pełny tytuł urzędowy
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{title}</p>
        </details>
      ) : null}
    </>
  );
}
