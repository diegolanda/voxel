"use client";

import { useGameStore } from "../../store/game-store";
import { HOTBAR_BLOCKS, BLOCK_NAMES } from "@voxel/engine";
import type { VoiceSettings } from "@voxel/voice";
import type { VoiceHudControlHandlers, VoiceHudViewModel } from "@voxel/ui";
import type { RealtimeConnectionStatus } from "../../lib/realtime/room-realtime-session";
import styles from "./HUD.module.css";

const HOTBAR_LABELS = HOTBAR_BLOCKS.map((b) => BLOCK_NAMES[b] ?? "?");

interface HUDProps {
  network?: {
    connectionStatus: RealtimeConnectionStatus;
    peerCount: number;
    roomId: string;
  };
  voice?: {
    permission: VoiceHudViewModel["permission"];
    settings: VoiceSettings;
    onEnable: () => void;
    onDisable: () => void;
    onSettingsChange: (next: Partial<VoiceSettings>) => void;
  };
  save?: {
    onSave: () => void;
    saving: boolean;
    notice: string | null;
  };
  errorMessage?: string | null;
}

export function HUD({ network, voice, save, errorMessage }: HUDProps) {
  const fps = useGameStore((s) => s.fps);
  const selectedSlot = useGameStore((s) => s.selectedSlot);
  const hitBlockName = useGameStore((s) => s.hitBlockName);
  const voiceViewModel: VoiceHudViewModel | null = voice
    ? {
        muted: voice.settings.muted,
        volume: voice.settings.volume,
        proximityRadius: voice.settings.proximityRadius,
        permission: voice.permission
      }
    : null;
  const voiceHandlers: VoiceHudControlHandlers | null = voice
    ? {
        onToggleMute: () => {
          voice.onSettingsChange({ muted: !voice.settings.muted });
        },
        onVolumeChange: (nextVolume: number) => {
          voice.onSettingsChange({ volume: nextVolume });
        },
        onProximityRadiusChange: (nextRadius: number) => {
          voice.onSettingsChange({ proximityRadius: nextRadius });
        }
      }
    : null;
  const onEnableVoice = voice ? voice.onEnable : null;
  const onDisableVoice = voice ? voice.onDisable : null;

  return (
    <div className={styles.hud}>
      {/* Crosshair */}
      <div className={styles.crosshair}>+</div>

      {/* FPS counter */}
      <div className={styles.fps}>{fps} FPS</div>
      {network && (
        <div className={styles.network}>
          <div>Room: {network.roomId.slice(0, 8)}</div>
          <div>Status: {network.connectionStatus}</div>
          <div>Peers: {network.peerCount + 1}/5</div>
        </div>
      )}
      {save && (
        <div className={styles.savePanel}>
          <button
            type="button"
            className={styles.saveButton}
            disabled={save.saving}
            onClick={save.onSave}
          >
            {save.saving ? "Saving..." : "Save World"}
          </button>
          {save.notice && <div className={styles.saveNotice}>{save.notice}</div>}
        </div>
      )}
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}
      <div className={styles.controls}>
        <div>Move: WASD / Arrows</div>
        <div>Lock Cursor: Click World</div>
        <div>Look: Mouse</div>
        <div>Jump: Space</div>
        <div>Break: Left Click</div>
        <div>Place: Right Click</div>
        <div>Hotbar: 1-9</div>
      </div>
      {voiceViewModel && voiceHandlers && (
        <div className={styles.voicePanel}>
          <div className={styles.voiceTitle}>Voice</div>
          <div className={styles.voiceRow}>Permission: {voiceViewModel.permission}</div>
          <div className={styles.voiceButtons}>
            <button
              type="button"
              onClick={onEnableVoice ?? undefined}
            >
              Enable Mic
            </button>
            <button
              type="button"
              onClick={onDisableVoice ?? undefined}
            >
              Disable Mic
            </button>
            <button
              type="button"
              onClick={voiceHandlers.onToggleMute}
            >
              {voiceViewModel.muted ? "Unmute" : "Mute"}
            </button>
          </div>
          <label className={styles.voiceRow}>
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={voiceViewModel.volume}
              onChange={(event) => {
                voiceHandlers.onVolumeChange(Number(event.currentTarget.value));
              }}
            />
          </label>
          <label className={styles.voiceRow}>
            Radius
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={voiceViewModel.proximityRadius}
              onChange={(event) => {
                voiceHandlers.onProximityRadiusChange(
                  Number(event.currentTarget.value)
                );
              }}
            />
          </label>
        </div>
      )}

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
