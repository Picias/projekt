"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import AvatarPicker from "@/components/avatar-picker";
import {
  emptyToNull,
  MIEJSCOWOSC_OPTIONS,
  PARTIA_OPTIONS,
  PLEC_OPTIONS,
  profileToForm,
  ROCZNIK_OPTIONS,
  WYKSZTALCENIE_OPTIONS,
  type Profile,
  type ProfileFormValues,
} from "@/lib/profile";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type OnboardingFormProps = {
  userId: string;
  profile: Profile | null;
  nextPath: string;
};

function PrivacyToggle({
  label = "Pokaż na publicznym profilu",
  checked,
  onChange,
  disabled,
}: {
  label?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-2 flex items-center justify-between gap-3">
      <span className="text-xs text-white/50">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-sejm-green" : "bg-white/15"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </span>
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl bg-white/5 px-3 py-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400/50"
      >
        <option value="" disabled className="bg-navy-900 text-white/50">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-navy-900">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
        className="w-full rounded-xl bg-white/5 px-3 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-emerald-400/50"
      />
      {hint ? <span className="text-xs text-white/40">{hint}</span> : null}
    </label>
  );
}

export default function OnboardingForm({
  userId,
  profile,
  nextPath,
}: OnboardingFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(profileToForm(profile));
  const [pending, setPending] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || uploadingAvatar;

  function patch(partial: Partial<ProfileFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const rok = Number(values.rok_urodzenia);

    if (!Number.isInteger(rok)) {
      setError("Wybierz rocznik.");
      setPending(false);
      return;
    }

    const supabase = createBrowserSupabase();
    const payload = {
      id: userId,
      imie: emptyToNull(values.imie),
      nazwisko: emptyToNull(values.nazwisko),
      pseudonim: emptyToNull(values.pseudonim),
      avatar_url: emptyToNull(values.avatar_url),
      plec: values.plec,
      rok_urodzenia: rok,
      wyksztalcenie: values.wyksztalcenie,
      wielkosc_miejscowosci: values.wielkosc_miejscowosci,
      popierana_partia: values.popierana_partia,
      pokaz_dane_osobowe: values.pokaz_dane_osobowe,
      pokaz_plec: values.pokaz_plec,
      pokaz_wiek: values.pokaz_wiek,
      pokaz_wyksztalcenie: values.pokaz_wyksztalcenie,
      pokaz_miejscowosc: values.pokaz_miejscowosc,
      pokaz_partie: values.pokaz_partie,
      zaktualizowano_at: new Date().toISOString(),
    };

    const { error: saveError } = await supabase.from("profile").upsert(payload, {
      onConflict: "id",
    });

    if (saveError) {
      setError(saveError.message);
      setPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  const yearOptions = ROCZNIK_OPTIONS.map(String);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AvatarPicker
        userId={userId}
        avatarUrl={values.avatar_url}
        imie={values.imie}
        pseudonim={values.pseudonim}
        disabled={pending}
        onUrlChange={(avatar_url) => patch({ avatar_url })}
        onError={setError}
        onBusyChange={setUploadingAvatar}
      />

      <div className="flex flex-col gap-5">
        <TextField
          label="Imię"
          value={values.imie}
          onChange={(imie) => patch({ imie })}
          placeholder="Opcjonalnie"
        />
        <TextField
          label="Nazwisko"
          value={values.nazwisko}
          onChange={(nazwisko) => patch({ nazwisko })}
          placeholder="Opcjonalnie"
        />
        <TextField
          label="Pseudonim"
          value={values.pseudonim}
          onChange={(pseudonim) => patch({ pseudonim })}
          placeholder="Opcjonalnie"
          hint="Może zastąpić imię i nazwisko w aplikacji."
        />
        <PrivacyToggle
          label="Pokaż moje imię i nazwisko na profilu publicznym"
          checked={values.pokaz_dane_osobowe}
          onChange={(pokaz_dane_osobowe) => patch({ pokaz_dane_osobowe })}
          disabled={busy}
        />
      </div>

      <div>
        <SelectField
          label="Płeć"
          value={values.plec}
          onChange={(plec) => patch({ plec })}
          options={PLEC_OPTIONS}
          placeholder="Wybierz płeć"
        />
        <PrivacyToggle
          checked={values.pokaz_plec}
          onChange={(pokaz_plec) => patch({ pokaz_plec })}
          disabled={busy}
        />
      </div>

      <div>
        <SelectField
          label="Rocznik"
          value={values.rok_urodzenia}
          onChange={(rok_urodzenia) => patch({ rok_urodzenia })}
          options={yearOptions}
          placeholder="Wybierz rok urodzenia"
        />
        <PrivacyToggle
          checked={values.pokaz_wiek}
          onChange={(pokaz_wiek) => patch({ pokaz_wiek })}
          disabled={busy}
        />
      </div>

      <div>
        <SelectField
          label="Wykształcenie"
          value={values.wyksztalcenie}
          onChange={(wyksztalcenie) => patch({ wyksztalcenie })}
          options={WYKSZTALCENIE_OPTIONS}
          placeholder="Wybierz wykształcenie"
        />
        <PrivacyToggle
          checked={values.pokaz_wyksztalcenie}
          onChange={(pokaz_wyksztalcenie) => patch({ pokaz_wyksztalcenie })}
          disabled={busy}
        />
      </div>

      <div>
        <SelectField
          label="Wielkość miejscowości"
          value={values.wielkosc_miejscowosci}
          onChange={(wielkosc_miejscowosci) => patch({ wielkosc_miejscowosci })}
          options={MIEJSCOWOSC_OPTIONS}
          placeholder="Gdzie mieszkasz"
        />
        <PrivacyToggle
          checked={values.pokaz_miejscowosc}
          onChange={(pokaz_miejscowosc) => patch({ pokaz_miejscowosc })}
          disabled={busy}
        />
      </div>

      <div>
        <SelectField
          label="Popierana partia"
          value={values.popierana_partia}
          onChange={(popierana_partia) => patch({ popierana_partia })}
          options={PARTIA_OPTIONS}
          placeholder="Wybierz partię"
        />
        <PrivacyToggle
          checked={values.pokaz_partie}
          onChange={(pokaz_partie) => patch({ pokaz_partie })}
          disabled={busy}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-xl bg-sejm-green px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sejm-green/85 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
        Zapisz profil
      </button>
    </form>
  );
}
