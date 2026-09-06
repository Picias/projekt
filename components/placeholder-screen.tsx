import BackButton from "@/components/back-button";

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export default function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps) {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton />

      <h1 className="text-3xl font-bold leading-tight">{title}</h1>

      <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <p className="text-sm leading-relaxed text-white/70">{description}</p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-sejm-green-light">
          Wkrótce
        </p>
      </div>
    </div>
  );
}
