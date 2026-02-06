import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_WORLDS_PER_ACCOUNT,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_DISPLAY_NAME_MIN_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
  isMvpTheme,
  type MvpTheme
} from "@voxel/domain";

export const SUPABASE_SCHEMA = "public";
export const ROOM_PASSWORD_MIN_LENGTH = 8;
export const ROOM_PASSWORD_MAX_LENGTH = 72;
export const ROOM_DEFAULT_STATUS = "lobby";
export const JOIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const JOIN_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
export const PASSWORD_HASH_ITERATIONS = 120_000;

export const AVATAR_COLORS = [
  "#2A9D8F",
  "#E76F51",
  "#264653",
  "#F4A261",
  "#3D5A80",
  "#EE6C4D",
  "#118AB2"
] as const;

export interface SupabaseEnvironment {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface RoomCreateInput {
  name: string;
  theme: MvpTheme;
  password: string;
  seed: string;
}

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
  env: Partial<SupabaseEnvironment>
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

export function createServiceRoleClient(
  env: Partial<SupabaseEnvironment>
): SupabaseClient {
  const runtime = readSupabaseEnvironment(env);
  const serviceRoleKey = requireEnvValue(
    runtime.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  return createClient(runtime.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function normalizeDisplayName(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length < PROFILE_DISPLAY_NAME_MIN_LENGTH ||
    trimmed.length > PROFILE_DISPLAY_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `Display name must be ${PROFILE_DISPLAY_NAME_MIN_LENGTH}-${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters`
    );
  }

  return trimmed;
}

export function normalizeAvatarColor(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new Error("Avatar color must be a hex color like #1A2B3C");
  }

  return normalized;
}

export function normalizeRoomName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < ROOM_NAME_MIN_LENGTH || trimmed.length > ROOM_NAME_MAX_LENGTH) {
    throw new Error(
      `Room name must be ${ROOM_NAME_MIN_LENGTH}-${ROOM_NAME_MAX_LENGTH} characters`
    );
  }

  return trimmed;
}

export function normalizeRoomTheme(value: string): MvpTheme {
  if (!isMvpTheme(value)) {
    throw new Error("Theme must be one of: forest, snow, coast");
  }

  return value;
}

export function normalizeRoomSeed(value?: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : crypto.randomUUID();
}

export function normalizeRoomPassword(value: string): string {
  if (
    value.length < ROOM_PASSWORD_MIN_LENGTH ||
    value.length > ROOM_PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Password must be ${ROOM_PASSWORD_MIN_LENGTH}-${ROOM_PASSWORD_MAX_LENGTH} characters`
    );
  }

  return value;
}

export function normalizeRoomCreateInput(input: {
  name?: string;
  theme?: string;
  password?: string;
  seed?: string;
}): RoomCreateInput {
  return {
    name: normalizeRoomName(input.name ?? ""),
    theme: normalizeRoomTheme(input.theme ?? ""),
    password: normalizeRoomPassword(input.password ?? ""),
    seed: normalizeRoomSeed(input.seed)
  };
}

export function createInviteToken(): string {
  return crypto.randomUUID();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(input: string): Uint8Array {
  if (input.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal input");
  }

  const bytes = new Uint8Array(input.length / 2);
  for (let index = 0; index < input.length; index += 2) {
    bytes[index / 2] = Number.parseInt(input.slice(index, index + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations,
      name: "PBKDF2",
      salt
    },
    key,
    256
  );

  return new Uint8Array(hashBuffer);
}

export async function hashRoomPassword(password: string): Promise<string> {
  const normalizedPassword = normalizeRoomPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(
    normalizedPassword,
    salt,
    PASSWORD_HASH_ITERATIONS
  );

  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyRoomPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  try {
    const parts = encodedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
      return false;
    }

    const iterations = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations <= 0) {
      return false;
    }

    const salt = hexToBytes(parts[2]);
    const expectedHash = hexToBytes(parts[3]);
    const actualHash = await derivePasswordHash(password, salt, iterations);
    return timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}

export function getRequestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "0.0.0.0";
}

export async function createJoinAttemptKey(
  roomId: string,
  ipAddress: string
): Promise<string> {
  const source = new TextEncoder().encode(`${roomId}:${ipAddress}`);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return bytesToHex(new Uint8Array(digest));
}

export function hasReachedWorldCap(existingRoomCount: number): boolean {
  return existingRoomCount >= MAX_WORLDS_PER_ACCOUNT;
}
