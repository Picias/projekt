import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import { formatVoteDate } from "@/lib/mp-stats";
import {
  fetchSejmInterpellation,
  getInterpellationStatusClass,
  resolveInterpellationStatus,
  type InterpellationDetails,
  type InterpellationReply,
} from "@/lib/sejm-voting";

type InterpellationPageProps = {
  params: Promise<{ num: string }>;
};

function formatRecipient(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function generateMetadata({ params }: InterpellationPageProps) {
  const { num } = await params;

  if (!/^\d+$/.test(num)) {
    return { title: "Nie znaleziono interpelacji — SEJM ON" };
  }

  const result = await fetchSejmInterpellation(num);

  if (result.status !== "ok") {
    return { title: "Nie znaleziono interpelacji — SEJM ON" };
  }

  return {
    title: `Interpelacja nr ${result.details.num} — SEJM ON`,
    description: result.details.title,
  };
}

function FetchError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do poprzedniej strony" />
      <section className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-semibold text-red-100">Nie udało się wczytać interpelacji</p>
        <p className="mt-2">{message}</p>
      </section>
    </div>
  );
}

function SejmHtmlBody({
  html,
  emptyMessage,
}: {
  html: string | null | undefined;
  emptyMessage: string;
}) {
  if (!html) {
    return <p className="text-sm leading-relaxed text-white/50">{emptyMessage}</p>;
  }

  return (
    <div
      className="sejm-html break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function replyEmptyMessage(reply: InterpellationReply): string {
  if (reply.prolongation) {
    return "Przedłużenie terminu odpowiedzi. Treść przedłużenia nie jest publikowana w API Sejmu.";
  }

  if (reply.onlyAttachment) {
    return "Odpowiedź została przekazana wyłącznie w załączniku PDF.";
  }

  return "Brak treści HTML tej odpowiedzi w API Sejmu.";
}

function ReplyCard({ reply }: { reply: InterpellationReply }) {
  const isProlongation = Boolean(reply.prolongation);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-navy-800/70">
      <header className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-white">
            {reply.from?.trim() || "Adresat interpelacji"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {reply.receiptDate ? formatVoteDate(reply.receiptDate) : "Data nieznana"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isProlongation
              ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/25"
              : "bg-sejm-green/15 text-sejm-green-light ring-1 ring-sejm-green/30"
          }`}
        >
          {isProlongation ? "Przedłużenie" : "Odpowiedź"}
        </span>
      </header>

      <div className="border-t border-white/10 bg-navy-950/40 px-5 py-4">
        <SejmHtmlBody html={reply.htmlBody} emptyMessage={replyEmptyMessage(reply)} />
      </div>
    </article>
  );
}

function InterpellationBody({ details }: { details: InterpellationDetails }) {
  const status = resolveInterpellationStatus(details);
  const recipients = details.to?.map(formatRecipient).filter(Boolean) ?? [];
  const replies = [...(details.replies ?? [])].sort((a, b) =>
    (a.receiptDate ?? "").localeCompare(b.receiptDate ?? ""),
  );

  return (
    <>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Interpelacja nr {details.num}
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getInterpellationStatusClass(status)}`}
        >
          {status}
        </span>
        <h1 className="mt-4 text-2xl font-bold leading-snug">{details.title}</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-navy-800/70 p-5">
        {recipients.length > 0 ? (
          <p className="text-sm leading-relaxed text-white/75">
            <span className="font-semibold text-white">Do: </span>
            {recipients.join(", ")}
          </p>
        ) : (
          <p className="text-sm text-white/50">Brak wskazanego adresata w API Sejmu.</p>
        )}
        {details.receiptDate ? (
          <p className="text-xs text-white/45">
            Data wpływu: {formatVoteDate(details.receiptDate)}
          </p>
        ) : null}
        {details.sentDate ? (
          <p className="text-xs text-white/45">
            Wysłano: {formatVoteDate(details.sentDate)}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-navy-800/50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Treść interpelacji
        </p>
        <div className="mt-4">
          <SejmHtmlBody
            html={details.htmlBody}
            emptyMessage="Brak treści HTML tej interpelacji w API Sejmu."
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Odpowiedzi
        </h2>
        {replies.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/60">
            Brak odpowiedzi w API Sejmu.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((reply, index) => (
              <ReplyCard key={reply.key ?? `${reply.receiptDate ?? "reply"}-${index}`} reply={reply} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default async function InterpellationPage({ params }: InterpellationPageProps) {
  const { num } = await params;

  if (!/^\d+$/.test(num)) {
    notFound();
  }

  const result = await fetchSejmInterpellation(num, { includeBodies: true });

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return <FetchError message={result.message} />;
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do poprzedniej strony" />
      <InterpellationBody details={result.details} />
    </div>
  );
}
