import type { Metadata } from "next";
import BackButton from "@/components/back-button";
import SpeechViewer from "@/components/speech-viewer";

type WystapieniePageProps = {
  searchParams: Promise<{ path?: string }>;
};

export const metadata: Metadata = {
  title: "Wystąpienie — SEJM ON",
  description: "Retransmisja i stenogram wystąpienia poselskiego z Sejmu RP.",
};

export default async function WystapieniePage({ searchParams }: WystapieniePageProps) {
  const { path: rawPath } = await searchParams;
  const path = rawPath?.trim() ?? "";

  if (!path) {
    return (
      <div className="flex flex-col gap-6 px-5 py-5">
        <BackButton />
        <section className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
          <p className="font-semibold text-red-100">Brak wystąpienia</p>
          <p className="mt-2">Nie przekazano ścieżki wystąpienia ze strony Sejmu.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton />
      <SpeechViewer path={path} />
    </div>
  );
}
