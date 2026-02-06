import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createServiceRoleClient, readSupabaseEnvironment } from "@voxel/supabase";
import { cookies } from "next/headers";

function getRuntimeConfig() {
  return readSupabaseEnvironment(process.env);
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const runtime = getRuntimeConfig();

  return createServerClient(
    runtime.NEXT_PUBLIC_SUPABASE_URL,
    runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components may not be able to set cookies; middleware keeps sessions fresh.
          }
        }
      }
    }
  );
}

export function createAdminSupabaseClient() {
  return createServiceRoleClient(process.env);
}
