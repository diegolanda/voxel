"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserSupabaseClient: SupabaseClient | null = null;

function requirePublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required client env: ${name}`);
  }
  return value;
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  browserSupabaseClient = createClient(
    requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requirePublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );

  return browserSupabaseClient;
}
