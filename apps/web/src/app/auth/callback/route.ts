import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/app";
  const error_description = searchParams.get("error_description");

  // Handle errors from Supabase
  if (error_description) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    );
  }

  const supabase = await createServerSupabaseClient();

  // Handle PKCE flow with code parameter (modern Supabase magic links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('PKCE code exchange error:', error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Handle legacy token_hash flow
  if (token_hash && type) {
    const otpType = type === 'signup' ? 'signup' : type === 'magiclink' ? 'magiclink' : 'email';
    
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as any,
      token_hash
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('OTP verification error:', error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Check if session already exists (middleware might have set it)
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Invalid authentication link")}`
  );
}
