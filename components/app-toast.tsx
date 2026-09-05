"use client";

type AppToastProps = {
  message: string | null;
  tone?: "ok" | "error";
};

export default function AppToast({ message, tone = "ok" }: AppToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-5"
    >
      <p
        className={`rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg ring-1 ${
          tone === "error"
            ? "bg-red-600 text-white ring-red-400/30"
            : "bg-navy-800/95 text-white ring-white/15 backdrop-blur-sm"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
