"use client";

import { useRef, useEffect } from "react";
import { createEngineRuntime } from "@voxel/engine";
import type { MvpTheme, QualityPreset } from "@voxel/domain";
import type { PlayerState } from "@voxel/engine";
import { useGameStore } from "../../store/game-store";

interface VoxelCanvasProps {
  theme: MvpTheme;
  seed: string;
  quality: QualityPreset;
  onPlayerStateChange?: (state: PlayerState) => void;
}

export function VoxelCanvas({
  theme,
  seed,
  quality,
  onPlayerStateChange
}: VoxelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setFps = useGameStore((s) => s.setFps);
  const setSelectedSlot = useGameStore((s) => s.setSelectedSlot);
  const setHitBlockName = useGameStore((s) => s.setHitBlockName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const runtime = createEngineRuntime(
      { theme, seed, quality },
      {
        onFps: setFps,
        onSlotChange: setSelectedSlot,
        onHitBlockChange: setHitBlockName,
        onPlayerStateChange
      },
    );

    runtime.mount(canvas);

    return () => {
      runtime.dispose();
    };
  }, [
    theme,
    seed,
    quality,
    onPlayerStateChange,
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
