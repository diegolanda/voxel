import {
  BlockType,
  CHUNK_WIDTH,
  CHUNK_DEPTH,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
} from "@voxel/domain";
import type { ChunkCoord } from "@voxel/domain";
import type { NoiseGenerator } from "./noise";
import type { BiomeConfig } from "./theme-config";

/**
 * Index into a flat Uint8Array chunk: y * 256 + z * 16 + x
 */
export function voxelIndex(x: number, y: number, z: number): number {
  return y * (CHUNK_WIDTH * CHUNK_DEPTH) + z * CHUNK_WIDTH + x;
}

/**
 * Multi-octave 2D noise for heightmap generation.
 */
function fbm2D(
  noise2D: (x: number, y: number) => number,
  x: number,
  z: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / max;
}

/**
 * Simple hash for deterministic tree placement.
 * Returns a value in [0, 1).
 */
function positionHash(x: number, z: number, seed: string): number {
  let h = 0;
  const str = `${x},${z},${seed}`;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((h & 0x7fffffff) % 10000) / 10000;
}

/**
 * Generate a chunk's voxel data as a flat Uint8Array.
 */
export function generateChunk(
  coord: ChunkCoord,
  noise: NoiseGenerator,
  config: BiomeConfig,
  seed: string,
): Uint8Array {
  const data = new Uint8Array(CHUNK_SIZE);
  const worldOffsetX = coord.x * CHUNK_WIDTH;
  const worldOffsetZ = coord.z * CHUNK_DEPTH;

  for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
    for (let lz = 0; lz < CHUNK_DEPTH; lz++) {
      const wx = worldOffsetX + lx;
      const wz = worldOffsetZ + lz;

      // Heightmap: multi-octave noise
      const noiseVal = fbm2D(
        noise.noise2D,
        wx * config.terrainScale,
        wz * config.terrainScale,
        4,
        2.0,
        0.5,
      );
      // Map noise from [-1,1] to height range
      const height = Math.floor(
        config.baseHeight + noiseVal * config.heightVariation,
      );
      const clampedHeight = Math.max(0, Math.min(CHUNK_HEIGHT - 1, height));

      // Fill column
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const idx = voxelIndex(lx, y, lz);
        if (y === 0) {
          // Bedrock layer (stone)
          data[idx] = BlockType.Stone;
        } else if (y < clampedHeight - 4) {
          data[idx] = config.deepBlock;
        } else if (y < clampedHeight - 1) {
          data[idx] = config.subsurfaceBlock;
        } else if (y === clampedHeight) {
          // Surface — use shore block near water level
          if (clampedHeight <= config.waterLevel + 1 && clampedHeight >= config.waterLevel - 1) {
            data[idx] = config.shoreBlock;
          } else {
            data[idx] = config.surfaceBlock;
          }
        } else if (y <= clampedHeight) {
          data[idx] = config.subsurfaceBlock;
        } else if (y <= config.waterLevel) {
          data[idx] = config.waterBlock;
        } else {
          data[idx] = BlockType.Air;
        }
      }

      // Deterministic tree placement
      if (
        clampedHeight > config.waterLevel + 1 &&
        clampedHeight < CHUNK_HEIGHT - 8 &&
        lx >= 2 && lx < CHUNK_WIDTH - 2 &&
        lz >= 2 && lz < CHUNK_DEPTH - 2
      ) {
        const treeRoll = positionHash(wx, wz, seed);
        if (treeRoll < config.treeChance) {
          placeTree(data, lx, clampedHeight + 1, lz, config);
        }
      }
    }
  }

  return data;
}

function placeTree(
  data: Uint8Array,
  x: number,
  baseY: number,
  z: number,
  config: BiomeConfig,
): void {
  const trunkHeight = 4 + ((x * 7 + z * 13) % 3); // 4-6 blocks tall, deterministic

  // Trunk
  for (let dy = 0; dy < trunkHeight; dy++) {
    const y = baseY + dy;
    if (y >= CHUNK_HEIGHT) return;
    data[voxelIndex(x, y, z)] = config.treeTrunkBlock;
  }

  // Leaves canopy (simple sphere-ish)
  const leafStart = baseY + trunkHeight - 1;
  for (let dy = -1; dy <= 2; dy++) {
    const y = leafStart + dy;
    if (y < 0 || y >= CHUNK_HEIGHT) continue;
    const radius = dy <= 0 ? 2 : 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0 && dy < 2) continue; // trunk passes through
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= CHUNK_WIDTH || nz < 0 || nz >= CHUNK_DEPTH) continue;
        if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy > 0) continue; // round corners
        if (data[voxelIndex(nx, y, nz)] === BlockType.Air) {
          data[voxelIndex(nx, y, nz)] = config.treeLeafBlock;
        }
      }
    }
  }
}
