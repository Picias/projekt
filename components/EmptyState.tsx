import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

export default function EmptyState({
  title,
  description,
  icon: Icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <Icon
          size={64}
          strokeWidth={1.25}
          className="text-emerald-400/25"
          aria-hidden
        />
      ) : null}
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  );
}
