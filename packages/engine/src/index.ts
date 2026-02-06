import { BlockType, CHUNK_HEIGHT, QUALITY_PRESETS } from "@voxel/domain";
import { THEME_CONFIGS } from "@voxel/worldgen";
import type { EngineConfig, InputState } from "./types";
import { setupScene } from "./renderer/scene-setup";
import { ChunkManager } from "./chunk-manager";
import { DesktopInput } from "./input/desktop-input";
import { MobileInput } from "./input/mobile-input";
import { createPlayerState, updatePlayer } from "./physics/player-controller";
import { BlockInteraction } from "./interaction/block-interaction";
import { GameLoop } from "./game-loop";

export interface EngineRuntimeContract {
  mount(canvas: HTMLCanvasElement): void;
  dispose(): void;
}

export interface EngineCallbacks {
  onFps?: (fps: number) => void;
  onSlotChange?: (slot: number) => void;
  onHitBlockChange?: (blockName: string | null) => void;
}

const BLOCK_NAMES: Record<number, string> = {
  [BlockType.Grass]: "Grass",
  [BlockType.Dirt]: "Dirt",
  [BlockType.Stone]: "Stone",
  [BlockType.Sand]: "Sand",
  [BlockType.Water]: "Water",
  [BlockType.WoodLog]: "Wood Log",
  [BlockType.Planks]: "Planks",
  [BlockType.Leaves]: "Leaves",
  [BlockType.Snow]: "Snow",
  [BlockType.Ice]: "Ice",
  [BlockType.WhiteStone]: "White Stone",
  [BlockType.Cobblestone]: "Cobblestone",
};

// Hotbar block types (1-indexed to match display)
const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.WoodLog,
  BlockType.Planks,
  BlockType.Cobblestone,
  BlockType.Leaves,
  BlockType.Snow,
];

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function createEngineRuntime(
  config: EngineConfig,
  callbacks?: EngineCallbacks,
): EngineRuntimeContract {
  let disposed = false;
  let gameLoop: GameLoop | null = null;
  let desktopInput: DesktopInput | null = null;
  let mobileInput: MobileInput | null = null;
  let sceneCtx: ReturnType<typeof setupScene> | null = null;
  let chunkManager: ChunkManager | null = null;

  return {
    mount(canvas: HTMLCanvasElement) {
      const themeConfig = THEME_CONFIGS[config.theme];
      const qualityConfig = QUALITY_PRESETS[config.quality];

      // Scene setup
      sceneCtx = setupScene(canvas, themeConfig, qualityConfig.pixelRatioCap);
      const { scene, camera, renderer, blockMaterial, chunkGroup } = sceneCtx;

      // Worker
      const worker = new Worker(
        new URL("./workers/chunk-worker.ts", import.meta.url),
        { type: "module" },
      );

      // Chunk manager
      chunkManager = new ChunkManager(worker, chunkGroup, blockMaterial);

      // Player state — spawn at center, high up so we fall to terrain
      let playerState = createPlayerState(8, CHUNK_HEIGHT - 1, 8);

      // Selected block for placement
      let selectedSlot = 0;

      // Determine camera look direction from yaw/pitch
      const getCameraDirection = (): [number, number, number] => {
        const [yaw, pitch] = playerState.rotation;
        return [
          -Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch),
        ];
      };

      // Block interaction
      const blockInteraction = new BlockInteraction(chunkManager, camera, getCameraDirection);

      const handleBreak = () => {
        blockInteraction.update();
        blockInteraction.breakBlock();
      };

      const handlePlace = () => {
        blockInteraction.update();
        blockInteraction.placeBlock(HOTBAR_BLOCKS[selectedSlot]);
      };

      // Input
      const isTouch = isTouchDevice();
      if (isTouch) {
        mobileInput = new MobileInput(canvas, {
          onLeftClick: handleBreak,
          onRightClick: handlePlace,
        });
      } else {
        desktopInput = new DesktopInput(canvas, {
          onSlotChange: (slot) => {
            selectedSlot = slot;
            callbacks?.onSlotChange?.(slot);
          },
          onLeftClick: handleBreak,
          onRightClick: handlePlace,
        });
      }

      // Game loop
      gameLoop = new GameLoop({
        update(dt) {
          if (disposed) return;

          // Read input
          const input: InputState = isTouch
            ? mobileInput!.getState()
            : desktopInput!.getState();

          // Update player
          playerState = updatePlayer(
            playerState,
            input,
            dt,
            (x, y, z) => chunkManager!.getBlock(x, y, z),
          );

          // Clear input deltas
          if (isTouch) {
            mobileInput!.clearDeltas();
          } else {
            desktopInput!.clearDeltas();
          }

          // Update camera from player state
          const [px, py, pz] = playerState.position;
          const [yaw, pitch] = playerState.rotation;
          camera.position.set(px, py + 1.6, pz); // Eye height
          camera.rotation.order = "YXZ";
          camera.rotation.y = yaw;
          camera.rotation.x = pitch;

          // Load/unload chunks
          chunkManager!.updateChunksAroundPlayer(
            px, pz,
            qualityConfig.viewDistance,
            config.seed,
            config.theme,
          );

          // Raycast for block highlight
          blockInteraction.update();
          if (blockInteraction.currentHit) {
            const hitBlock = chunkManager!.getBlock(
              blockInteraction.currentHit.hit.x,
              blockInteraction.currentHit.hit.y,
              blockInteraction.currentHit.hit.z,
            );
            callbacks?.onHitBlockChange?.(BLOCK_NAMES[hitBlock] ?? null);
          } else {
            callbacks?.onHitBlockChange?.(null);
          }
        },
        render() {
          if (disposed || !sceneCtx) return;
          renderer.render(scene, camera);
        },
        onFps: callbacks?.onFps,
      });

      gameLoop.start();
    },

    dispose() {
      disposed = true;
      gameLoop?.stop();
      desktopInput?.dispose();
      mobileInput?.dispose();
      chunkManager?.dispose();
      sceneCtx?.dispose();
      gameLoop = null;
      desktopInput = null;
      mobileInput = null;
      chunkManager = null;
      sceneCtx = null;
    },
  };
}

export type { EngineConfig } from "./types";
export { HOTBAR_BLOCKS, BLOCK_NAMES };
