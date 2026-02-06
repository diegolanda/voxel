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

  // Fill with magenta for debugging unmapped tiles
  ctx.fillStyle = "#ff00ff";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < BLOCK_COLORS.length; i++) {
    const [topColor, bottomColor] = BLOCK_COLORS[i];
    const x = i * tileSize;
    const y = 0;

    // Create subtle vertical gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + tileSize);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, tileSize, tileSize);

    // Add subtle noise/pixel detail
    ctx.fillStyle = `rgba(0,0,0,0.05)`;
    for (let px = 0; px < tileSize; px += 2) {
      for (let py = 0; py < tileSize; py += 2) {
        if ((px + py) % 4 === 0) {
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
