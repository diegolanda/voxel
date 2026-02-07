import * as THREE from "three";
import {
  BlockType,
  CHUNK_WIDTH,
  CHUNK_DEPTH,
  CHUNK_HEIGHT,
  chunkKey,
  worldToChunk,
} from "@voxel/domain";
import type { ChunkCoord, MvpTheme } from "@voxel/domain";
import type { ChunkDiff } from "@voxel/protocol";
import type { WorkerRequest, WorkerResponse } from "./types";

interface ModifiedBlock {
  localIndex: number;
  blockType: number;
}

export class ChunkManager {
  private worker: Worker;
  private chunkData = new Map<string, Uint8Array>();
  private chunkMeshes = new Map<string, THREE.Mesh>();
  private pendingChunks = new Set<string>();
  private chunkGroup: THREE.Group;
  private material: THREE.MeshLambertMaterial;
  /** Tracks player-modified blocks per chunk: chunkKey → Map<localIndex, blockType> */
  private modifiedBlocks = new Map<string, Map<number, number>>();

  constructor(
    worker: Worker,
    chunkGroup: THREE.Group,
    material: THREE.MeshLambertMaterial,
  ) {
    this.worker = worker;
    this.chunkGroup = chunkGroup;
    this.material = material;

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "generated") {
        this.onChunkGenerated(msg.coord, msg.voxelData);
      } else if (msg.type === "meshed") {
        this.onChunkMeshed(msg.coord, msg.vertices, msg.normals, msg.uvs, msg.indices);
      }
    };
  }

  private onChunkGenerated(coord: ChunkCoord, voxelData: Uint8Array): void {
    const key = chunkKey(coord);
    this.chunkData.set(key, voxelData);

    // Request meshing
    const msg: WorkerRequest = { type: "mesh", coord, voxelData };
    this.worker.postMessage(msg, [voxelData.buffer] as unknown as Transferable[]);
  }

  private onChunkMeshed(
    coord: ChunkCoord,
    vertices: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
  ): void {
    const key = chunkKey(coord);
    this.pendingChunks.delete(key);

    if (vertices.length === 0) return;

    // Remove old mesh if exists
    const oldMesh = this.chunkMeshes.get(key);
    if (oldMesh) {
      this.chunkGroup.remove(oldMesh);
      oldMesh.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(coord.x * CHUNK_WIDTH, 0, coord.z * CHUNK_DEPTH);
    mesh.frustumCulled = true;

    this.chunkMeshes.set(key, mesh);
    this.chunkGroup.add(mesh);
  }

  updateChunksAroundPlayer(
    px: number,
    pz: number,
    viewDistance: number,
    seed: string,
    theme: MvpTheme,
  ): void {
    const playerChunk = worldToChunk(px, pz);
    const neededKeys = new Set<string>();

    // Request missing chunks within view distance
    for (let dx = -viewDistance; dx <= viewDistance; dx++) {
      for (let dz = -viewDistance; dz <= viewDistance; dz++) {
        const coord: ChunkCoord = { x: playerChunk.x + dx, z: playerChunk.z + dz };
        const key = chunkKey(coord);
        neededKeys.add(key);

        if (!this.chunkData.has(key) && !this.pendingChunks.has(key)) {
          this.pendingChunks.add(key);
          const msg: WorkerRequest = { type: "generate", coord, seed, theme };
          this.worker.postMessage(msg);
        }
      }
    }

    // Unload distant chunks
    for (const [key, mesh] of this.chunkMeshes) {
      if (!neededKeys.has(key)) {
        this.chunkGroup.remove(mesh);
        mesh.geometry.dispose();
        this.chunkMeshes.delete(key);
        this.chunkData.delete(key);
      }
    }
    // Also clean chunkData entries without meshes
    for (const key of this.chunkData.keys()) {
      if (!neededKeys.has(key)) {
        this.chunkData.delete(key);
      }
    }
  }

  getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
    if (worldY < 0 || worldY >= CHUNK_HEIGHT) return BlockType.Air;

    const cx = Math.floor(worldX / CHUNK_WIDTH);
    const cz = Math.floor(worldZ / CHUNK_DEPTH);
    const key = chunkKey({ x: cx, z: cz });
    const data = this.chunkData.get(key);
    if (!data) return BlockType.Air;

    let lx = worldX - cx * CHUNK_WIDTH;
    let lz = worldZ - cz * CHUNK_DEPTH;
    // Handle negative world coordinates
    if (lx < 0) lx += CHUNK_WIDTH;
    if (lz < 0) lz += CHUNK_DEPTH;

    const idx = Math.floor(worldY) * (CHUNK_WIDTH * CHUNK_DEPTH) + Math.floor(lz) * CHUNK_WIDTH + Math.floor(lx);
    return data[idx] as BlockType;
  }

  setBlock(worldX: number, worldY: number, worldZ: number, blockType: BlockType): void {
    if (worldY < 0 || worldY >= CHUNK_HEIGHT) return;

    const cx = Math.floor(worldX / CHUNK_WIDTH);
    const cz = Math.floor(worldZ / CHUNK_DEPTH);
    const key = chunkKey({ x: cx, z: cz });
    const data = this.chunkData.get(key);
    if (!data) return;

    let lx = worldX - cx * CHUNK_WIDTH;
    let lz = worldZ - cz * CHUNK_DEPTH;
    if (lx < 0) lx += CHUNK_WIDTH;
    if (lz < 0) lz += CHUNK_DEPTH;

    const idx = Math.floor(worldY) * (CHUNK_WIDTH * CHUNK_DEPTH) + Math.floor(lz) * CHUNK_WIDTH + Math.floor(lx);

    // Track modification
    let chunkMods = this.modifiedBlocks.get(key);
    if (!chunkMods) {
      chunkMods = new Map();
      this.modifiedBlocks.set(key, chunkMods);
    }
    chunkMods.set(idx, blockType);

    // We need a new copy since the buffer may have been transferred
    const newData = new Uint8Array(data.length);
    newData.set(data);
    newData[idx] = blockType;
    this.chunkData.set(key, newData);

    // Re-mesh the chunk
    const coord: ChunkCoord = { x: cx, z: cz };
    const msg: WorkerRequest = { type: "mesh", coord, voxelData: newData };
    const transferCopy = new Uint8Array(newData);
    this.worker.postMessage(msg, [transferCopy.buffer] as unknown as Transferable[]);
  }

  /** Extract all player-modified blocks as ChunkDiff array for snapshot serialization. */
  getModifiedChunkDiffs(): ChunkDiff[] {
    const diffs: ChunkDiff[] = [];
    for (const [key, mods] of this.modifiedBlocks) {
      if (mods.size === 0) continue;
      const parts = key.split(",");
      const cx = Number.parseInt(parts[0], 10);
      const cz = Number.parseInt(parts[1], 10);
      const entries: ChunkDiff["entries"] = [];
      for (const [localIndex, blockType] of mods) {
        entries.push({ localIndex, blockType });
      }
      diffs.push({ cx, cz, entries });
    }
    return diffs;
  }

  /** Apply chunk diffs on top of already-generated terrain (used for resume). */
  applyChunkDiffs(diffs: ChunkDiff[]): void {
    for (const diff of diffs) {
      const key = chunkKey({ x: diff.cx, z: diff.cz });
      const data = this.chunkData.get(key);
      if (!data) continue;

      const newData = new Uint8Array(data.length);
      newData.set(data);

      let chunkMods = this.modifiedBlocks.get(key);
      if (!chunkMods) {
        chunkMods = new Map();
        this.modifiedBlocks.set(key, chunkMods);
      }

      for (const entry of diff.entries) {
        newData[entry.localIndex] = entry.blockType;
        chunkMods.set(entry.localIndex, entry.blockType);
      }

      this.chunkData.set(key, newData);

      // Re-mesh
      const coord: ChunkCoord = { x: diff.cx, z: diff.cz };
      const msg: WorkerRequest = { type: "mesh", coord, voxelData: newData };
      const transferCopy = new Uint8Array(newData);
      this.worker.postMessage(msg, [transferCopy.buffer] as unknown as Transferable[]);
    }
  }

  /** Get pending chunk diffs that can't be applied yet (chunks not loaded). */
  filterPendingDiffs(diffs: ChunkDiff[]): { applied: ChunkDiff[]; pending: ChunkDiff[] } {
    const applied: ChunkDiff[] = [];
    const pending: ChunkDiff[] = [];
    for (const diff of diffs) {
      const key = chunkKey({ x: diff.cx, z: diff.cz });
      if (this.chunkData.has(key)) {
        applied.push(diff);
      } else {
        pending.push(diff);
      }
    }
    return { applied, pending };
  }

  dispose(): void {
    for (const [, mesh] of this.chunkMeshes) {
      mesh.geometry.dispose();
    }
    this.chunkMeshes.clear();
    this.chunkData.clear();
    this.pendingChunks.clear();
    this.modifiedBlocks.clear();
    this.worker.terminate();
  }
}
