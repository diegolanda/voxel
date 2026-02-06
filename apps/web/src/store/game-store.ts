import { create } from "zustand";
import type { MvpTheme, QualityPreset } from "@voxel/domain";

interface GameState {
  theme: MvpTheme;
  seed: string;
  selectedSlot: number;
  quality: QualityPreset;
  fps: number;
  hitBlockName: string | null;

  setTheme: (theme: MvpTheme) => void;
  setSeed: (seed: string) => void;
  setSelectedSlot: (slot: number) => void;
  setQuality: (quality: QualityPreset) => void;
  setFps: (fps: number) => void;
  setHitBlockName: (name: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  theme: "forest",
  seed: "",
  selectedSlot: 0,
  quality: "medium",
  fps: 0,
  hitBlockName: null,

  setTheme: (theme) => set({ theme }),
  setSeed: (seed) => set({ seed }),
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  setQuality: (quality) => set({ quality }),
  setFps: (fps) => set({ fps }),
  setHitBlockName: (name) => set({ hitBlockName: name }),
}));
