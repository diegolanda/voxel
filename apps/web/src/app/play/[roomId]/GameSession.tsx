"use client";

import { useEffect } from "react";
import type { MvpTheme } from "@voxel/domain";
import { VoxelCanvas } from "../../../components/game/VoxelCanvas";
import { HUD } from "../../../components/game/HUD";
import { TouchControls } from "../../../components/game/TouchControls";
import { useGameStore } from "../../../store/game-store";

interface GameSessionProps {
  theme: MvpTheme;
  seed: string;
  roomId: string;
}

export function GameSession({ theme, seed }: GameSessionProps) {
  const quality = useGameStore((s) => s.quality);
  const setTheme = useGameStore((s) => s.setTheme);
  const setSeed = useGameStore((s) => s.setSeed);

  useEffect(() => {
    setTheme(theme);
    setSeed(seed);
  }, [theme, seed, setTheme, setSeed]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <VoxelCanvas theme={theme} seed={seed} quality={quality} />
      <HUD />
      <TouchControls />
    </div>
  );
}
