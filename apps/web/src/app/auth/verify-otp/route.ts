import { redirectTo } from "../../../lib/http";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const nextPath = String(formData.get("next") ?? "/login");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();

  if (!email || !token) {
    return redirectTo(request, nextPath, {
      email,
      error: "Email and OTP code are required"
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email"
  });

  if (error) {
    return redirectTo(request, nextPath, {
      email,
      error: error.message
    });
  }

  return redirectTo(request, "/app", {
    notice: "Signed in successfully"
  });
}
