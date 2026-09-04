import { createServerSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import WiecejView from "@/components/wiecej-view";

export default async function WiecejPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <WiecejView isAdmin={isAdminEmail(user?.email)} />;
}
