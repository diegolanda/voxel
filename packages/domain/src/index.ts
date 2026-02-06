export const MVP_THEMES = ["forest", "snow", "coast"] as const;
export type MvpTheme = (typeof MVP_THEMES)[number];

export const MAX_PLAYERS_PER_ROOM = 5;
export const MAX_WORLDS_PER_ACCOUNT = 3;
export const ROOM_NAME_MIN_LENGTH = 3;
export const ROOM_NAME_MAX_LENGTH = 64;
export const PROFILE_DISPLAY_NAME_MIN_LENGTH = 2;
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;

export type RoomStatus = "lobby" | "active" | "closed";
export type RoomMemberRole = "host" | "guest";

export interface RoomIdentity {
  roomId: string;
  inviteToken: string;
}

export interface Profile {
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface RoomSummary {
  id: string;
  hostId: string;
  name: string;
  theme: MvpTheme;
  seed: string;
  inviteToken: string;
  status: RoomStatus;
  maxPlayers: number;
  createdAt: string;
}

export function isMvpTheme(value: string): value is MvpTheme {
  return (MVP_THEMES as readonly string[]).includes(value);
}

// ── Block types ──────────────────────────────────────────────────────

export const enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
  WoodLog = 6,
  Planks = 7,
  Leaves = 8,
  Snow = 9,
  Ice = 10,
  WhiteStone = 11,
  Cobblestone = 12,
}

// ── Chunk constants ──────────────────────────────────────────────────

export const CHUNK_WIDTH = 16;
export const CHUNK_DEPTH = 16;
export const CHUNK_HEIGHT = 64;
export const CHUNK_SIZE = CHUNK_WIDTH * CHUNK_DEPTH * CHUNK_HEIGHT; // 16384

// ── Coordinates ──────────────────────────────────────────────────────

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

export function worldToChunk(worldX: number, worldZ: number): ChunkCoord {
  return {
    x: Math.floor(worldX / CHUNK_WIDTH),
    z: Math.floor(worldZ / CHUNK_DEPTH),
  };
}

export function chunkKey(coord: ChunkCoord): string {
  return `${coord.x},${coord.z}`;
}

// ── Quality presets ──────────────────────────────────────────────────

export type QualityPreset = "low" | "medium" | "high";

export interface QualityConfig {
  viewDistance: number;
  pixelRatioCap: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  low: { viewDistance: 4, pixelRatioCap: 1 },
  medium: { viewDistance: 6, pixelRatioCap: 1.5 },
  high: { viewDistance: 8, pixelRatioCap: 2 },
};
