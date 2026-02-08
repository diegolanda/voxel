import { BlockType, CHUNK_HEIGHT, QUALITY_PRESETS } from "@voxel/domain";
import { THEME_CONFIGS } from "@voxel/worldgen";
import type { ChunkDiff } from "@voxel/protocol";
import type { EngineConfig, InputState, RemotePlayerState } from "./types";
import { setupScene } from "./renderer/scene-setup";
import { ChunkManager } from "./chunk-manager";
import { PlayerAvatarManager } from "./renderer/player-avatar-manager";
import { DesktopInput } from "./input/desktop-input";
import { MobileInput } from "./input/mobile-input";
import { createPlayerState, updatePlayer } from "./physics/player-controller";
import { BlockInteraction } from "./interaction/block-interaction";
import { GameLoop } from "./game-loop";
import type { PlayerState } from "./types";

export interface BlockEditInfo {
  operation: "place" | "break";
  x: number;
  y: number;
  z: number;
  blockType: number;
}

export interface EngineRuntimeContract {
  mount(canvas: HTMLCanvasElement): void;
  dispose(): void;
  /** Trigger a block break at current crosshair target. */
  breakBlock(): boolean;
  /** Place currently selected block at current crosshair target. */
  placeBlock(): boolean;
  /** Trigger jump on next simulation tick. */
  jump(): void;
  /** Select hotbar slot by index (0-8). */
  selectSlot(slot: number): void;
  getSelectedSlot(): number;
  /** Extract all player-modified blocks for snapshot serialization. */
  getModifiedChunkDiffs(): ChunkDiff[];
  /** Apply saved chunk diffs on top of generated terrain (resume). */
  applyChunkDiffs(diffs: ChunkDiff[]): void;
  /** Apply a single block edit from a remote peer. */
  applyBlockEdit(x: number, y: number, z: number, blockType: number): void;
  /** Update remote player avatars (Steve models) from network state. */
  updateRemotePlayers(states: Map<string, RemotePlayerState>): void;
}

export interface EngineCallbacks {
  onFps?: (fps: number) => void;
  onSlotChange?: (slot: number) => void;
  onHitBlockChange?: (blockName: string | null) => void;
  onPlayerStateChange?: (state: PlayerState) => void;
  onBlockEdit?: (edit: BlockEditInfo) => void;
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
  let avatarManager: PlayerAvatarManager | null = null;
  const pendingDiffs: ChunkDiff[] = [];
  let selectedSlot = 0;
  let queuedJump = false;
  let blockInteraction: BlockInteraction | null = null;
  let remoteStates: Map<string, RemotePlayerState> = new Map();

  const applySlotSelection = (slot: number) => {
    const clamped = Math.max(0, Math.min(HOTBAR_BLOCKS.length - 1, slot));
    selectedSlot = clamped;
    callbacks?.onSlotChange?.(clamped);
  };

  const handleBreak = (): boolean => {
    if (!blockInteraction) return false;
    blockInteraction.update();
    const hit = blockInteraction.currentHit;
    if (!hit) return false;
    if (!blockInteraction.breakBlock()) return false;
    callbacks?.onBlockEdit?.({
      operation: "break",
      x: hit.hit.x,
      y: hit.hit.y,
      z: hit.hit.z,
      blockType: BlockType.Air,
    });
    return true;
  };

  const handlePlace = (): boolean => {
    if (!blockInteraction) return false;
    blockInteraction.update();
    const hit = blockInteraction.currentHit;
    if (!hit) return false;
    const bt = HOTBAR_BLOCKS[selectedSlot];
    if (!blockInteraction.placeBlock(bt)) return false;
    callbacks?.onBlockEdit?.({
      operation: "place",
      x: hit.face.x,
      y: hit.face.y,
      z: hit.face.z,
      blockType: bt,
    });
    return true;
  };

  return {
    mount(canvas: HTMLCanvasElement) {
      const themeConfig = THEME_CONFIGS[config.theme];
      const qualityConfig = QUALITY_PRESETS[config.quality];

      // Scene setup
      sceneCtx = setupScene(canvas, themeConfig, qualityConfig.pixelRatioCap);
      const { scene, camera, renderer, blockMaterial, chunkGroup, avatarGroup } = sceneCtx;

      // Avatar manager for remote player Steve models
      avatarManager = new PlayerAvatarManager(avatarGroup);

      // Worker
      const worker = new Worker(
        new URL("./workers/chunk-worker.ts", import.meta.url),
        { type: "module" },
      );

      // Chunk manager
      chunkManager = new ChunkManager(worker, chunkGroup, blockMaterial);

      // Player state — spawn at center, high up so we fall to terrain
      let playerState = createPlayerState(8, CHUNK_HEIGHT - 1, 8);

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
      blockInteraction = new BlockInteraction(chunkManager, camera, getCameraDirection);
      applySlotSelection(selectedSlot);

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
            applySlotSelection(slot);
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
          if (queuedJump) {
            input.jump = true;
            queuedJump = false;
          }

          // Update player
          playerState = updatePlayer(
            playerState,
            input,
            dt,
            (x, y, z) => chunkManager!.getBlock(x, y, z),
          );
          callbacks?.onPlayerStateChange?.(playerState);

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

          // Keep sky dome centered on camera
          sceneCtx!.updateSky(camera.position);

          // Update remote player avatars
          avatarManager!.updateRemotePlayers(remoteStates, dt);

          // Load/unload chunks
          chunkManager!.updateChunksAroundPlayer(
            px, pz,
            qualityConfig.viewDistance,
            config.seed,
            config.theme,
          );

          // Apply any pending snapshot diffs to newly loaded chunks
          if (pendingDiffs.length > 0) {
            const { applied, pending } = chunkManager!.filterPendingDiffs(pendingDiffs);
            if (applied.length > 0) {
              chunkManager!.applyChunkDiffs(applied);
              pendingDiffs.length = 0;
              pendingDiffs.push(...pending);
            }
          }

          // Raycast for block highlight
          const interaction = blockInteraction;
          if (!interaction) return;
          interaction.update();
          if (interaction.currentHit) {
            const hitBlock = chunkManager!.getBlock(
              interaction.currentHit.hit.x,
              interaction.currentHit.hit.y,
              interaction.currentHit.hit.z,
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

    breakBlock(): boolean {
      return handleBreak();
    },

    placeBlock(): boolean {
      return handlePlace();
    },

    jump(): void {
      queuedJump = true;
      mobileInput?.triggerJump();
    },

    selectSlot(slot: number): void {
      applySlotSelection(slot);
    },

    getSelectedSlot(): number {
      return selectedSlot;
    },

    getModifiedChunkDiffs(): ChunkDiff[] {
      return chunkManager?.getModifiedChunkDiffs() ?? [];
    },

    applyChunkDiffs(diffs: ChunkDiff[]): void {
      if (!chunkManager) return;
      const { applied, pending } = chunkManager.filterPendingDiffs(diffs);
      chunkManager.applyChunkDiffs(applied);
      // Store pending diffs to apply when chunks load
      if (pending.length > 0) {
        pendingDiffs.push(...pending);
      }
    },

    applyBlockEdit(x: number, y: number, z: number, blockType: number): void {
      chunkManager?.setBlock(x, y, z, blockType as BlockType);
    },

    updateRemotePlayers(states: Map<string, RemotePlayerState>): void {
      remoteStates = states;
    },

    dispose() {
      disposed = true;
      gameLoop?.stop();
      desktopInput?.dispose();
      mobileInput?.dispose();
      avatarManager?.dispose();
      chunkManager?.dispose();
      sceneCtx?.dispose();
      gameLoop = null;
      desktopInput = null;
      mobileInput = null;
      avatarManager = null;
      chunkManager = null;
      sceneCtx = null;
      blockInteraction = null;
    },
  };
}

export type { EngineConfig } from "./types";
export type { PlayerState } from "./types";
export type { RemotePlayerState } from "./types";
export { HOTBAR_BLOCKS, BLOCK_NAMES };
