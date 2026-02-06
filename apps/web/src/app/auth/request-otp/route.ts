import { redirectTo } from "../../../lib/http";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const nextPath = String(formData.get("next") ?? "/login");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return redirectTo(request, nextPath, {
      error: "Email is required"
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true
    }
  });

  if (error) {
    return redirectTo(request, nextPath, {
      email,
      error: error.message
    });
  }

  return redirectTo(request, nextPath, {
    email,
    notice: "OTP code sent. Check your inbox."
  });
}
