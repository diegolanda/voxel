import { redirectTo } from "../../../lib/http";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return redirectTo(request, "/login", {
    notice: "Signed out"
  });
}
