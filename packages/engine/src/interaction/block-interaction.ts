import { BlockType } from "@voxel/domain";
import type { VoxelCoord } from "@voxel/domain";
import type { ChunkManager } from "../chunk-manager";

const MAX_REACH = 8;

export interface RaycastHit {
  hit: VoxelCoord;
  face: VoxelCoord; // Adjacent position for block placement
}

/**
 * DDA raycasting through voxel grid.
 * Returns the first solid block hit and the adjacent face position.
 */
export function raycastVoxels(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  getBlock: (x: number, y: number, z: number) => BlockType,
): RaycastHit | null {
  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dirX > 0 ? 1 : -1;
  const stepY = dirY > 0 ? 1 : -1;
  const stepZ = dirZ > 0 ? 1 : -1;

  const tDeltaX = dirX !== 0 ? Math.abs(1 / dirX) : Infinity;
  const tDeltaY = dirY !== 0 ? Math.abs(1 / dirY) : Infinity;
  const tDeltaZ = dirZ !== 0 ? Math.abs(1 / dirZ) : Infinity;

  let tMaxX = dirX !== 0 ? ((dirX > 0 ? x + 1 : x) - originX) / dirX : Infinity;
  let tMaxY = dirY !== 0 ? ((dirY > 0 ? y + 1 : y) - originY) / dirY : Infinity;
  let tMaxZ = dirZ !== 0 ? ((dirZ > 0 ? z + 1 : z) - originZ) / dirZ : Infinity;

  let prevX = x;
  let prevY = y;
  let prevZ = z;
  let t = 0;

  while (t < MAX_REACH) {
    const block = getBlock(x, y, z);
    if (block !== BlockType.Air && block !== BlockType.Water) {
      return {
        hit: { x, y, z },
        face: { x: prevX, y: prevY, z: prevZ },
      };
    }

    prevX = x;
    prevY = y;
    prevZ = z;

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        x += stepX;
        tMaxX += tDeltaX;
      } else {
        t = tMaxZ;
        z += stepZ;
        tMaxZ += tDeltaZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        t = tMaxY;
        y += stepY;
        tMaxY += tDeltaY;
      } else {
        t = tMaxZ;
        z += stepZ;
        tMaxZ += tDeltaZ;
      }
    }
  }

  return null;
}

export class BlockInteraction {
  private chunkManager: ChunkManager;
  private camera: { position: { x: number; y: number; z: number } };
  private getDirection: () => [number, number, number];
  currentHit: RaycastHit | null = null;

  constructor(
    chunkManager: ChunkManager,
    camera: { position: { x: number; y: number; z: number } },
    getDirection: () => [number, number, number],
  ) {
    this.chunkManager = chunkManager;
    this.camera = camera;
    this.getDirection = getDirection;
  }

  update(): void {
    const [dx, dy, dz] = this.getDirection();
    this.currentHit = raycastVoxels(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      dx, dy, dz,
      (x, y, z) => this.chunkManager.getBlock(x, y, z),
    );
  }

  breakBlock(): boolean {
    if (!this.currentHit) return false;
    const { x, y, z } = this.currentHit.hit;
    this.chunkManager.setBlock(x, y, z, BlockType.Air);
    return true;
  }

  placeBlock(blockType: BlockType): boolean {
    if (!this.currentHit) return false;
    const { x, y, z } = this.currentHit.face;
    // Don't place if the face position is the same as hit (origin block)
    const h = this.currentHit.hit;
    if (x === h.x && y === h.y && z === h.z) return false;
    this.chunkManager.setBlock(x, y, z, blockType);
    return true;
  }
}
