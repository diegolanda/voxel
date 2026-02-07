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
import {
  serializeSnapshot,
  deserializeSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  type WorldSnapshot
} from "@voxel/protocol";

export const SUPABASE_SCHEMA = "public";
export const ROOM_PASSWORD_MIN_LENGTH = 8;
export const ROOM_PASSWORD_MAX_LENGTH = 72;
export const ROOM_DEFAULT_STATUS = "lobby";
export const JOIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const JOIN_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
export const PASSWORD_HASH_ITERATIONS = 120_000;
export const ROOM_SNAPSHOTS_TABLE = "room_snapshots";
export const ROOM_EVENTS_TABLE = "room_events";
export const LATE_JOIN_REPLAY_DEFAULT_LIMIT = 500;
export const LATE_JOIN_REPLAY_MAX_LIMIT = 2_000;
export const WORLD_SAVES_TABLE = "world_saves";
export const WORLD_SNAPSHOTS_BUCKET = "world-snapshots";
export const MAX_SAVE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

export type SupabaseEnvironmentInput =
  | Partial<SupabaseEnvironment>
  | Record<string, string | undefined>;

export interface RoomCreateInput {
  name: string;
  theme: MvpTheme;
  password: string;
  seed: string;
}

export interface LateJoinSnapshotRecord {
  roomId: string;
  snapshotId: string;
  storagePath: string;
  baseSequence: number;
  createdAt: string;
}

export interface LateJoinReplayQuery {
  roomId: string;
  minSequenceExclusive: number;
  limit: number;
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

export function createServiceRoleClient(
  env: SupabaseEnvironmentInput
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
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
      salt: toArrayBuffer(salt)
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

export function normalizeLateJoinReplayLimit(limit?: number): number {
  const resolved = limit ?? LATE_JOIN_REPLAY_DEFAULT_LIMIT;
  if (
    !Number.isInteger(resolved) ||
    resolved <= 0 ||
    resolved > LATE_JOIN_REPLAY_MAX_LIMIT
  ) {
    throw new Error(
      `Replay limit must be an integer between 1 and ${LATE_JOIN_REPLAY_MAX_LIMIT}`
    );
  }

  return resolved;
}

export function createLateJoinReplayQuery(input: {
  roomId: string;
  snapshotBaseSequence: number;
  limit?: number;
}): LateJoinReplayQuery {
  const roomId = input.roomId.trim();
  if (roomId.length === 0) {
    throw new Error("roomId is required");
  }

  if (
    !Number.isInteger(input.snapshotBaseSequence) ||
    input.snapshotBaseSequence < 0
  ) {
    throw new Error("snapshotBaseSequence must be a non-negative integer");
  }

  return {
    roomId,
    minSequenceExclusive: input.snapshotBaseSequence,
    limit: normalizeLateJoinReplayLimit(input.limit)
  };
}

// ── World Save Adapter ────────────────────────────────────────────────

export interface WorldSaveRecord {
  id: string;
  roomId: string;
  createdBy: string;
  storagePath: string;
  baseSequence: number;
  byteSize: number;
  formatVersion: number;
  createdAt: string;
}

export interface SaveWorldInput {
  roomId: string;
  userId: string;
  snapshot: WorldSnapshot;
}

export interface SaveWorldResult {
  ok: boolean;
  saveId?: string;
  storagePath?: string;
  byteSize?: number;
  error?: string;
}

export async function compressSnapshot(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

export async function decompressSnapshot(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}

export function buildSnapshotStoragePath(roomId: string, saveId: string): string {
  return `${roomId}/${saveId}.vxs.gz`;
}

export async function saveWorld(
  supabase: SupabaseClient,
  input: SaveWorldInput
): Promise<SaveWorldResult> {
  const saveId = crypto.randomUUID();
  const storagePath = buildSnapshotStoragePath(input.roomId, saveId);

  // Serialize and compress
  const raw = serializeSnapshot(input.snapshot);
  const compressed = await compressSnapshot(raw);

  if (compressed.byteLength > MAX_SAVE_SIZE_BYTES) {
    return { ok: false, error: `Save exceeds ${MAX_SAVE_SIZE_BYTES} byte limit` };
  }

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(WORLD_SNAPSHOTS_BUCKET)
    .upload(storagePath, compressed, {
      contentType: "application/gzip",
      upsert: false
    });

  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  // Insert record
  const { error: dbError } = await supabase
    .from(WORLD_SAVES_TABLE)
    .insert({
      id: saveId,
      room_id: input.roomId,
      created_by: input.userId,
      storage_path: storagePath,
      base_sequence: input.snapshot.sequence,
      byte_size: compressed.byteLength,
      format_version: SNAPSHOT_FORMAT_VERSION
    });

  if (dbError) {
    // Clean up uploaded file on DB failure
    await supabase.storage.from(WORLD_SNAPSHOTS_BUCKET).remove([storagePath]);
    return { ok: false, error: `Database insert failed: ${dbError.message}` };
  }

  return {
    ok: true,
    saveId,
    storagePath,
    byteSize: compressed.byteLength
  };
}

export async function loadLatestSave(
  supabase: SupabaseClient,
  roomId: string
): Promise<{ ok: true; save: WorldSaveRecord; snapshot: WorldSnapshot } | { ok: false; error: string }> {
  // Get latest save record
  const { data, error: dbError } = await supabase
    .from(WORLD_SAVES_TABLE)
    .select("id, room_id, created_by, storage_path, base_sequence, byte_size, format_version, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbError) {
    return { ok: false, error: `Failed to query saves: ${dbError.message}` };
  }

  if (!data) {
    return { ok: false, error: "no_save_found" };
  }

  // Download from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(WORLD_SNAPSHOTS_BUCKET)
    .download(data.storage_path);

  if (downloadError || !fileData) {
    return { ok: false, error: `Failed to download save: ${downloadError?.message ?? "empty file"}` };
  }

  // Decompress and deserialize
  const compressed = new Uint8Array(await fileData.arrayBuffer());
  const raw = await decompressSnapshot(compressed);
  const snapshot = deserializeSnapshot(raw);

  const save: WorldSaveRecord = {
    id: data.id,
    roomId: data.room_id,
    createdBy: data.created_by,
    storagePath: data.storage_path,
    baseSequence: data.base_sequence,
    byteSize: data.byte_size,
    formatVersion: data.format_version,
    createdAt: data.created_at
  };

  return { ok: true, save, snapshot };
}
