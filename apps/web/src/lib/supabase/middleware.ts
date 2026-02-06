import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnvironment } from "@voxel/supabase";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSupabaseSession(request: NextRequest) {
  const runtime = readSupabaseEnvironment(process.env);

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    runtime.NEXT_PUBLIC_SUPABASE_URL,
    runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}
