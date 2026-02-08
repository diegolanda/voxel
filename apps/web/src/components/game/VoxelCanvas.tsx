"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { createEngineRuntime } from "@voxel/engine";
import type { MvpTheme, QualityPreset } from "@voxel/domain";
import type { EngineRuntimeContract, PlayerState, BlockEditInfo } from "@voxel/engine";
import { useGameStore } from "../../store/game-store";

interface VoxelCanvasProps {
  theme: MvpTheme;
  seed: string;
  quality: QualityPreset;
  onPlayerStateChange?: (state: PlayerState) => void;
  onBlockEdit?: (edit: BlockEditInfo) => void;
}

export interface VoxelCanvasHandle {
  getRuntime(): EngineRuntimeContract | null;
  breakBlock(): boolean;
  placeBlock(): boolean;
  jump(): void;
  selectSlot(slot: number): void;
}

export const VoxelCanvas = forwardRef<VoxelCanvasHandle, VoxelCanvasProps>(
  function VoxelCanvas({ theme, seed, quality, onPlayerStateChange, onBlockEdit }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const runtimeRef = useRef<EngineRuntimeContract | null>(null);
    const setFps = useGameStore((s) => s.setFps);
    const setSelectedSlot = useGameStore((s) => s.setSelectedSlot);
    const setHitBlockName = useGameStore((s) => s.setHitBlockName);

    useImperativeHandle(ref, () => ({
      getRuntime: () => runtimeRef.current,
      breakBlock: () => runtimeRef.current?.breakBlock() ?? false,
      placeBlock: () => runtimeRef.current?.placeBlock() ?? false,
      jump: () => runtimeRef.current?.jump(),
      selectSlot: (slot) => runtimeRef.current?.selectSlot(slot),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const runtime = createEngineRuntime(
        { theme, seed, quality },
        {
          onFps: setFps,
          onSlotChange: setSelectedSlot,
          onHitBlockChange: setHitBlockName,
          onPlayerStateChange,
          onBlockEdit
        },
      );

      runtime.mount(canvas);
      runtimeRef.current = runtime;

      return () => {
        runtime.dispose();
        runtimeRef.current = null;
      };
    }, [
      theme,
      seed,
      quality,
      onPlayerStateChange,
      onBlockEdit,
      setFps,
      setSelectedSlot,
      setHitBlockName
    ]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />
    );
  }
);
