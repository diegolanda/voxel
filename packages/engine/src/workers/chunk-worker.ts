import { chunkKey } from "@voxel/domain";
import { createSeededNoise, generateChunk, THEME_CONFIGS } from "@voxel/worldgen";
import type { NoiseGenerator } from "@voxel/worldgen";
import { greedyMesh } from "../meshing/greedy-mesher";
import type { WorkerRequest, WorkerResponse } from "../types";

const noiseCache = new Map<string, NoiseGenerator>();

function getNoise(seed: string): NoiseGenerator {
  let noise = noiseCache.get(seed);
  if (!noise) {
    noise = createSeededNoise(seed);
    noiseCache.set(seed, noise);
  }
  return noise;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "generate") {
    const noise = getNoise(msg.seed);
    const config = THEME_CONFIGS[msg.theme];
    const voxelData = generateChunk(msg.coord, noise, config, msg.seed);

    const response: WorkerResponse = {
      type: "generated",
      coord: msg.coord,
      voxelData,
    };
    (self as unknown as Worker).postMessage(response, [voxelData.buffer] as unknown as Transferable[]);
  } else if (msg.type === "mesh") {
    const meshData = greedyMesh(msg.voxelData);

    const response: WorkerResponse = {
      type: "meshed",
      coord: msg.coord,
      vertices: meshData.vertices,
      normals: meshData.normals,
      uvs: meshData.uvs,
      indices: meshData.indices,
    };
    (self as unknown as Worker).postMessage(response, [
      meshData.vertices.buffer,
      meshData.normals.buffer,
      meshData.uvs.buffer,
      meshData.indices.buffer,
    ] as unknown as Transferable[]);
  }
};
