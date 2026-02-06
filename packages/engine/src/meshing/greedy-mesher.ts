import {
  BlockType,
  CHUNK_WIDTH,
  CHUNK_DEPTH,
  CHUNK_HEIGHT,
} from "@voxel/domain";

/**
 * Block UV atlas positions: column (u) in a 16x16 grid.
 * Row 0, column = blockType - 1 (Air has no texture).
 */
function blockAtlasU(block: BlockType): number {
  if (block === BlockType.Air) return 0;
  return ((block as number) - 1) / 16;
}

function blockAtlasV(_block: BlockType): number {
  return 0;
}

const TILE_UV = 1 / 16;

function voxelIndex(x: number, y: number, z: number): number {
  return y * (CHUNK_WIDTH * CHUNK_DEPTH) + z * CHUNK_WIDTH + x;
}

function isTransparent(block: number): boolean {
  return block === BlockType.Air || block === BlockType.Water;
}

export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * Greedy meshing for a single chunk.
 * Sweeps all 6 face directions, merges adjacent coplanar faces of same block type.
 */
export function greedyMesh(voxelData: Uint8Array): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  // Directions: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
  const dims = [CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH];

  for (let face = 0; face < 6; face++) {
    const axis = face >> 1; // 0,0,1,1,2,2
    const backFace = (face & 1) === 1;
    const normal = [0, 0, 0];
    normal[axis] = backFace ? -1 : 1;

    // u and v axes perpendicular to the face normal
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const pos = [0, 0, 0];
    const mask = new Int32Array(dims[u] * dims[v]);

    // Sweep slices along the face axis
    for (pos[axis] = -1; pos[axis] < dims[axis]; ) {
      // Build mask: which faces are visible at this slice boundary
      let maskIdx = 0;
      for (pos[v] = 0; pos[v] < dims[v]; pos[v]++) {
        for (pos[u] = 0; pos[u] < dims[u]; pos[u]++) {
          // Block on the negative side of the face
          const aCoord = [...pos];
          const bCoord = [...pos];
          bCoord[axis] += 1;

          let blockA = 0;
          let blockB = 0;

          if (aCoord[axis] >= 0) {
            blockA = getBlock(voxelData, aCoord[0], aCoord[1], aCoord[2]);
          }
          if (bCoord[axis] < dims[axis]) {
            blockB = getBlock(voxelData, bCoord[0], bCoord[1], bCoord[2]);
          }

          // Face is visible if one side is solid and other is transparent
          const aTransparent = isTransparent(blockA);
          const bTransparent = isTransparent(blockB);

          if (aTransparent === bTransparent) {
            mask[maskIdx++] = 0;
          } else if (!backFace) {
            // Positive direction: we see the face of blockA when B is air
            mask[maskIdx++] = bTransparent ? blockA : -blockB;
          } else {
            mask[maskIdx++] = aTransparent ? blockB : -blockA;
          }
        }
      }

      pos[axis]++;

      // Greedy merge: scan mask for rectangles of same block type
      maskIdx = 0;
      for (let j = 0; j < dims[v]; j++) {
        for (let i = 0; i < dims[u]; ) {
          const block = mask[maskIdx];
          if (block === 0) {
            i++;
            maskIdx++;
            continue;
          }

          // Compute width
          let w = 1;
          while (i + w < dims[u] && mask[maskIdx + w] === block) {
            w++;
          }

          // Compute height
          let h = 1;
          let done = false;
          while (j + h < dims[v] && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[maskIdx + h * dims[u] + k] !== block) {
                done = true;
                break;
              }
            }
            if (!done) h++;
          }

          // Emit quad
          const blockType = Math.abs(block) as BlockType;
          const du = [0, 0, 0];
          const dv = [0, 0, 0];
          du[u] = w;
          dv[v] = h;

          const origin = [0, 0, 0];
          origin[axis] = pos[axis];
          origin[u] = i;
          origin[v] = j;

          // 4 vertices for the quad
          const v0 = [origin[0], origin[1], origin[2]];
          const v1 = [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]];
          const v2 = [
            origin[0] + du[0] + dv[0],
            origin[1] + du[1] + dv[1],
            origin[2] + du[2] + dv[2],
          ];
          const v3 = [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]];

          // Atlas UVs
          const au = blockAtlasU(blockType);
          const av = blockAtlasV(blockType);

          if (block > 0) {
            // Front face winding
            positions.push(...v0, ...v1, ...v2, ...v3);
            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3,
            );
          } else {
            // Back face winding
            positions.push(...v0, ...v3, ...v2, ...v1);
            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3,
            );
          }

          for (let q = 0; q < 4; q++) {
            normals.push(normal[0], normal[1], normal[2]);
          }
          uvs.push(
            au, av + TILE_UV,
            au + TILE_UV * w, av + TILE_UV,
            au + TILE_UV * w, av,
            au, av,
          );

          vertexCount += 4;

          // Clear mask region
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              mask[maskIdx + dy * dims[u] + dx] = 0;
            }
          }

          i += w;
          maskIdx += w;
        }
      }
    }
  }

  return {
    vertices: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

function getBlock(data: Uint8Array, x: number, y: number, z: number): number {
  // Map from axis-order coordinates back to actual XYZ
  // The sweeping already uses actual coordinates, so this is direct
  if (
    x < 0 || x >= CHUNK_WIDTH ||
    y < 0 || y >= CHUNK_HEIGHT ||
    z < 0 || z >= CHUNK_DEPTH
  ) {
    return BlockType.Air;
  }
  return data[voxelIndex(x, y, z)];
}
