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

  // Derive the origin from the incoming request so the magic-link callback
  // always matches the current deployment URL (Vercel preview, production, local).
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback`
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
    notice: "Magic link sent! Check your email inbox and click the link to sign in."
  });
}
