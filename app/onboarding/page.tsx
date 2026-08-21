import { redirect } from "next/navigation";

import OnboardingForm from "@/components/onboarding-form";
import { isOnboardingComplete, safeNextPath, type Profile } from "@/lib/profile";
import { createServerSupabase } from "@/lib/supabase-server";

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const metadata = {
  title: "Twój profil — SEJM ON",
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/onboarding`);
  }

  const { data } = await supabase.from("profile").select("*").eq("id", user.id).maybeSingle();
  const profile = (data as Profile | null) ?? null;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <header>
        <h1 className="text-2xl font-bold">
          {isOnboardingComplete(profile) ? "Edytuj profil" : "Poznajmy się"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Te dane pomagają pokazać, kto stoi za głosami obywatelskimi. Nic nie
          wychodzi publicznie, dopóki nie włączysz przełącznika pod polem.
        </p>
      </header>

      <OnboardingForm userId={user.id} profile={profile} nextPath={nextPath} />
    </div>
  );
}
