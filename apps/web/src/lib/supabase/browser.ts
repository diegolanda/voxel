"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserSupabaseClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  // Access env vars directly so Next.js can inline them at build time.
  // Dynamic access like process.env[name] is NOT replaced by the compiler.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing required client env: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  // Use createBrowserClient from @supabase/ssr so the auth session is
  // read from cookies — matching the server client. Plain createClient
  // defaults to localStorage which doesn't share the server session.
  browserSupabaseClient = createBrowserClient(url, anonKey);
  return browserSupabaseClient;
}
