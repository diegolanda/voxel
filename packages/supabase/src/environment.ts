/**
 * Environment configuration for Supabase
 * This module is safe to import in Edge Runtime (middleware)
 */

export interface SupabaseEnvironment {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export type SupabaseEnvironmentInput =
  | Partial<SupabaseEnvironment>
  | Record<string, string | undefined>;

function requireEnvValue(
  value: string | undefined,
  name: keyof SupabaseEnvironment
): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readSupabaseEnvironment(
  env: SupabaseEnvironmentInput
): SupabaseEnvironment {
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireEnvValue(
      env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL"
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnvValue(
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY
  };
}
