import type { MvpTheme } from "@voxel/domain";
import { BlockType } from "@voxel/domain";

export interface SkyConfig {
  zenithColor: string;
  horizonColor: string;
  sunColor: string;
  sunAngularRadius: number;
  sunElevation: number;
  sunAzimuth: number;
  sunGlowIntensity: number;
}

export interface BiomeConfig {
  baseHeight: number;
  heightVariation: number;
  terrainScale: number;
  surfaceBlock: BlockType;
  subsurfaceBlock: BlockType;
  deepBlock: BlockType;
  waterLevel: number;
  waterBlock: BlockType;
  shoreBlock: BlockType;
  treeChance: number;
  treeTrunkBlock: BlockType;
  treeLeafBlock: BlockType;
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunIntensity: number;
  ambientIntensity: number;
  sky: SkyConfig;
}

export const THEME_CONFIGS: Record<MvpTheme, BiomeConfig> = {
  forest: {
    baseHeight: 20,
    heightVariation: 12,
    terrainScale: 0.02,
    surfaceBlock: BlockType.Grass,
    subsurfaceBlock: BlockType.Dirt,
    deepBlock: BlockType.Stone,
    waterLevel: 14,
    waterBlock: BlockType.Water,
    shoreBlock: BlockType.Sand,
    treeChance: 0.02,
    treeTrunkBlock: BlockType.WoodLog,
    treeLeafBlock: BlockType.Leaves,
    skyColor: "#87ceeb",
    fogColor: "#c8e6c9",
    fogNear: 80,
    fogFar: 220,
    sunIntensity: 1.0,
    ambientIntensity: 0.6,
    sky: {
      zenithColor: "#4a90d9",
      horizonColor: "#c8e6c9",
      sunColor: "#fff5d0",
      sunAngularRadius: 0.05,
      sunElevation: 1.1,
      sunAzimuth: 0.5,
      sunGlowIntensity: 0.3,
    },
  },
  snow: {
    baseHeight: 22,
    heightVariation: 15,
    terrainScale: 0.018,
    surfaceBlock: BlockType.Snow,
    subsurfaceBlock: BlockType.WhiteStone,
    deepBlock: BlockType.Stone,
    waterLevel: 16,
    waterBlock: BlockType.Ice,
    shoreBlock: BlockType.Snow,
    treeChance: 0.008,
    treeTrunkBlock: BlockType.WoodLog,
    treeLeafBlock: BlockType.Snow,
    skyColor: "#d6e8f0",
    fogColor: "#e8eef2",
    fogNear: 60,
    fogFar: 180,
    sunIntensity: 0.8,
    ambientIntensity: 0.7,
    sky: {
      zenithColor: "#b0c4d8",
      horizonColor: "#e8eef2",
      sunColor: "#e8e0d0",
      sunAngularRadius: 0.07,
      sunElevation: 0.6,
      sunAzimuth: 0.3,
      sunGlowIntensity: 0.5,
    },
  },
  coast: {
    baseHeight: 16,
    heightVariation: 8,
    terrainScale: 0.025,
    surfaceBlock: BlockType.Sand,
    subsurfaceBlock: BlockType.Sand,
    deepBlock: BlockType.Stone,
    waterLevel: 18,
    waterBlock: BlockType.Water,
    shoreBlock: BlockType.Sand,
    treeChance: 0.01,
    treeTrunkBlock: BlockType.WoodLog,
    treeLeafBlock: BlockType.Leaves,
    skyColor: "#7ec8e3",
    fogColor: "#b3d9e8",
    fogNear: 100,
    fogFar: 250,
    sunIntensity: 1.2,
    ambientIntensity: 0.65,
    sky: {
      zenithColor: "#2a7cc7",
      horizonColor: "#b3d9e8",
      sunColor: "#fffde0",
      sunAngularRadius: 0.05,
      sunElevation: 1.3,
      sunAzimuth: 0.8,
      sunGlowIntensity: 0.2,
    },
  },
};
