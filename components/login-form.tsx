"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";

import { isOnboardingComplete, safeNextPath, type Profile } from "@/lib/profile";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Mode = "login" | "register";

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Nieprawidłowy e-mail albo hasło.",
  "Email not confirmed": "Potwierdź adres e-mail, zanim się zalogujesz.",
  "User already registered": "To konto już istnieje. Zaloguj się.",
  "Password should be at least 6 characters.":
    "Hasło musi mieć co najmniej 6 znaków.",
  "Password should be at least 6 characters":
    "Hasło musi mieć co najmniej 6 znaków.",
  "Unable to validate email address: invalid format":
    "Podaj poprawny adres e-mail.",
  "Signup requires a valid password": "Podaj hasło, aby założyć konto.",
};

function mapAuthError(message: string): string {
  return AUTH_ERRORS[message] ?? "Nie udało się dokończyć operacji. Spróbuj ponownie.";
}

function onboardingHref(nextPath: string): string {
  return nextPath === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(nextPath)}`;
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </span>
      <span
        className={`flex items-center gap-2 rounded-xl bg-white/5 px-3 ring-1 focus-within:ring-emerald-400/50 ${
          error ? "ring-red-400/50" : "ring-white/10"
        }`}
      >
        <LockKeyhole size={16} className="shrink-0 text-white/35" aria-hidden />
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          minLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
          className="shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:text-white"
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </span>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </label>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPasswordMismatch(false);
    setPasswordConfirm("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPasswordMismatch(false);

    if (mode === "register" && password !== passwordConfirm) {
      setPasswordMismatch(true);
      return;
    }

    setPending(true);

    const supabase = createBrowserSupabase();
    const trimmedEmail = email.trim();

    try {
      if (mode === "register") {
        const origin = window.location.origin;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${origin}/onboarding`,
          },
        });

        if (signUpError) {
          setError(mapAuthError(signUpError.message));
          return;
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("To konto już istnieje. Zaloguj się.");
          return;
        }

        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

          if (signInError) {
            setError(mapAuthError(signInError.message));
            return;
          }
        }

        router.replace(onboardingHref(nextPath));
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(mapAuthError(signInError.message));
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Nie udało się odczytać sesji. Spróbuj ponownie.");
        return;
      }

      const { data: profile } = await supabase
        .from("profile")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const destination = isOnboardingComplete(profile as Profile | null)
        ? nextPath
        : onboardingHref(nextPath);

      router.replace(destination);
      router.refresh();
    } catch {
      setError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => switchMode(item)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              mode === item
                ? "bg-sejm-green text-white shadow-lg shadow-sejm-green/20"
                : "text-white/55 hover:text-white"
            }`}
          >
            {item === "login" ? "Logowanie" : "Rejestracja"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
            E-mail
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-white/5 px-3 ring-1 ring-white/10 focus-within:ring-emerald-400/50">
            <Mail size={16} className="shrink-0 text-white/35" aria-hidden />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30"
              placeholder="obywatel@example.com"
            />
          </span>
        </label>

        <PasswordField
          label="Hasło"
          name="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setPasswordMismatch(false);
          }}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "register" ? "Minimum 6 znaków" : "Twoje hasło"}
        />

        {mode === "register" ? (
          <PasswordField
            label="Powtórz hasło"
            name="password_confirm"
            value={passwordConfirm}
            onChange={(value) => {
              setPasswordConfirm(value);
              setPasswordMismatch(false);
            }}
            autoComplete="new-password"
            placeholder="Wpisz hasło ponownie"
            error={passwordMismatch ? "Hasła nie są identyczne" : null}
          />
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm leading-relaxed text-red-200"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-sejm-green px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sejm-green/85 disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {mode === "login" ? "Zaloguj się" : "Załóż konto"}
        </button>
      </form>
    </div>
  );
}
