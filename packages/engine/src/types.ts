import type { ChunkCoord, MvpTheme, QualityPreset } from "@voxel/domain";

export interface ChunkMesh {
  coord: ChunkCoord;
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

// ── Worker messages ──────────────────────────────────────────────────

export type WorkerRequest =
  | { type: "generate"; coord: ChunkCoord; seed: string; theme: MvpTheme }
  | { type: "mesh"; coord: ChunkCoord; voxelData: Uint8Array };

export type WorkerResponse =
  | { type: "generated"; coord: ChunkCoord; voxelData: Uint8Array }
  | {
      type: "meshed";
      coord: ChunkCoord;
      vertices: Float32Array;
      normals: Float32Array;
      uvs: Float32Array;
      indices: Uint32Array;
    };

// ── Player state ─────────────────────────────────────────────────────

export interface PlayerState {
  position: [number, number, number];
  rotation: [number, number]; // [yaw, pitch]
  velocity: [number, number, number];
  onGround: boolean;
}

// ── Input state ──────────────────────────────────────────────────────

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  pointerLocked: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
  touchJoystickX: number;
  touchJoystickY: number;
  touchLookDeltaX: number;
  touchLookDeltaY: number;
}

// ── Engine config ────────────────────────────────────────────────────

export interface EngineConfig {
  theme: MvpTheme;
  seed: string;
  quality: QualityPreset;
}
