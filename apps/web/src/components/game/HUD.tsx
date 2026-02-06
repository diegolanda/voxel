"use client";

import { useGameStore } from "../../store/game-store";
import { HOTBAR_BLOCKS, BLOCK_NAMES } from "@voxel/engine";
import styles from "./HUD.module.css";

const HOTBAR_LABELS = HOTBAR_BLOCKS.map((b) => BLOCK_NAMES[b] ?? "?");

export function HUD() {
  const fps = useGameStore((s) => s.fps);
  const selectedSlot = useGameStore((s) => s.selectedSlot);
  const hitBlockName = useGameStore((s) => s.hitBlockName);

  return (
    <div className={styles.hud}>
      {/* Crosshair */}
      <div className={styles.crosshair}>+</div>

      {/* FPS counter */}
      <div className={styles.fps}>{fps} FPS</div>

      {/* Block highlight label */}
      {hitBlockName && (
        <div className={styles.blockLabel}>{hitBlockName}</div>
      )}

      {/* Hotbar */}
      <div className={styles.hotbar}>
        {HOTBAR_LABELS.map((label, i) => (
          <div
            key={i}
            className={`${styles.hotbarSlot} ${i === selectedSlot ? styles.hotbarActive : ""}`}
          >
            <span className={styles.hotbarKey}>{i + 1}</span>
            <span className={styles.hotbarLabel}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
