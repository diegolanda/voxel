import * as THREE from "three";

/**
 * Block colors ordered by BlockType enum value (1-indexed, Air=0 has no tile).
 * Index 0 = Grass, 1 = Dirt, 2 = Stone, etc.
 */
const BLOCK_COLORS: [string, string][] = [
  // [topColor, bottomColor] for subtle gradient
  ["#5da845", "#4a8c37"], // Grass (1)
  ["#8b6b4a", "#6e5439"], // Dirt (2)
  ["#808080", "#666666"], // Stone (3)
  ["#d4c07a", "#c4a960"], // Sand (4)
  ["#3b7dd8", "#2860b0"], // Water (5)
  ["#7a5c34", "#5e4528"], // WoodLog (6)
  ["#b8944a", "#9c7a38"], // Planks (7)
  ["#3d9140", "#2d7030"], // Leaves (8)
  ["#f0f0f0", "#dcdcdc"], // Snow (9)
  ["#a8d8ea", "#8cc4d8"], // Ice (10)
  ["#e8e0d0", "#d4ccc0"], // WhiteStone (11)
  ["#6e6e6e", "#585858"], // Cobblestone (12)
];

function fillTile(ctx: CanvasRenderingContext2D, x: number, y: number, top: string, bottom: string): void {
  const gradient = ctx.createLinearGradient(x, y, x, y + 16);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, 16, 16);
}

function addTileNoise(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  for (let px = 0; px < 16; px += 2) {
    for (let py = 0; py < 16; py += 2) {
      if ((px + py) % 4 === 0) {
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}

/**
 * Creates a 256x256 procedural texture atlas.
 * 16x16 grid, each tile is 16px.
 * Block types map to column index = blockType - 1, row 0.
 */
export function createTextureAtlas(): THREE.CanvasTexture {
  const size = 256;
  const tileSize = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Fill every atlas tile to avoid fallback debug colors when UVs cross tile boundaries.
  for (let tx = 0; tx < size / tileSize; tx++) {
    for (let ty = 0; ty < size / tileSize; ty++) {
      const [topColor, bottomColor] = BLOCK_COLORS[tx % BLOCK_COLORS.length];
      const x = tx * tileSize;
      const y = ty * tileSize;
      fillTile(ctx, x, y, topColor, bottomColor);
      addTileNoise(ctx, x, y);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
