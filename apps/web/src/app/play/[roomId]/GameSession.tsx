"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MvpTheme } from "@voxel/domain";
import { detectDeviceProfile, recommendQualityPreset } from "@voxel/domain";
import type { PlayerState, BlockEditInfo } from "@voxel/engine";
import {
  serializeSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  type WorldSnapshot
} from "@voxel/protocol";
import {
  DEFAULT_VOICE_SETTINGS,
  normalizeVoiceSettings,
  type MicrophonePermissionState,
  type VoiceSettings
} from "@voxel/voice";
import { VoxelCanvas, type VoxelCanvasHandle } from "../../../components/game/VoxelCanvas";
import { HUD } from "../../../components/game/HUD";
import { TouchControls } from "../../../components/game/TouchControls";
import { useGameStore } from "../../../store/game-store";
import {
  RoomRealtimeSession,
  type RealtimeConnectionStatus,
  type RoomTurnConfig
} from "../../../lib/realtime/room-realtime-session";
import { reportError } from "../../../lib/error-reporter";

interface GameSessionProps {
  theme: MvpTheme;
  seed: string;
  roomId: string;
  userId: string;
  displayName: string;
  isHost: boolean;
  turn: RoomTurnConfig;
}

export function GameSession({
  theme,
  seed,
  roomId,
  userId,
  displayName,
  isHost,
  turn
}: GameSessionProps) {
  const quality = useGameStore((s) => s.quality);
  const setTheme = useGameStore((s) => s.setTheme);
  const setSeed = useGameStore((s) => s.setSeed);
  const sessionRef = useRef<RoomRealtimeSession | null>(null);
  const canvasRef = useRef<VoxelCanvasHandle>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>("idle");
  const [peerCount, setPeerCount] = useState(0);
  const [voicePermission, setVoicePermission] =
    useState<MicrophonePermissionState>("prompt");
  const [voiceSettings, setVoiceSettings] =
    useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [lastError, setLastError] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const sessionConfig = useMemo(
    () => ({
      roomId,
      userId,
      displayName,
      isHost,
      turn
    }),
    [roomId, userId, displayName, isHost, turn]
  );

  useEffect(() => {
    setTheme(theme);
    setSeed(seed);
  }, [theme, seed, setTheme, setSeed]);

  // Auto-detect quality preset from device profile on mount
  useEffect(() => {
    const profile = detectDeviceProfile();
    const preset = recommendQualityPreset(profile);
    useGameStore.getState().setQuality(preset);
  }, []);

  // Load existing save on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSave() {
      try {
        const res = await fetch(`/api/rooms/${roomId}/save`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.hasSave || !data.snapshot) return;
        // Wait for engine to be ready (small delay for chunks to generate)
        const waitForEngine = () => {
          if (cancelled) return;
          const runtime = canvasRef.current?.getRuntime();
          if (runtime) {
            runtime.applyChunkDiffs(data.snapshot.chunks);
          } else {
            setTimeout(waitForEngine, 200);
          }
        };
        // Give initial chunks time to generate before applying diffs
        setTimeout(waitForEngine, 1000);
      } catch (err) {
        reportError(err, { phase: "save-load", roomId });
      }
    }
    void loadSave();
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    const session = new RoomRealtimeSession({
      ...sessionConfig,
      onConnectionStatusChange: setConnectionStatus,
      onPeerCountChange: setPeerCount,
      onVoicePermissionChange: setVoicePermission,
      onRemotePlayersChange: (states) => {
        canvasRef.current?.getRuntime()?.updateRemotePlayers(states);
      },
      onRemoteBlockEdit: (edit) => {
        canvasRef.current?.getRuntime()?.applyBlockEdit(edit.x, edit.y, edit.z, edit.blockType);
      },
      onError: (msg) => {
        reportError(new Error(msg), { phase: "realtime", roomId });
        setLastError(msg);
      }
    });
    sessionRef.current = session;
    void session.start();

    return () => {
      void session.stop();
      sessionRef.current = null;
    };
  }, [sessionConfig]);

  const handlePlayerStateChange = useCallback((state: PlayerState) => {
    sessionRef.current?.updateLocalPlayerState(state);
  }, []);

  const handleBlockEdit = useCallback((edit: BlockEditInfo) => {
    sessionRef.current?.broadcastBlockEdit(edit);
  }, []);

  const handleEnableVoice = useCallback(() => {
    void sessionRef.current?.enableVoice().then((enabled) => {
      setMicActive(Boolean(enabled));
    });
  }, []);

  const handleDisableVoice = useCallback(() => {
    sessionRef.current?.disableVoice();
    setMicActive(false);
  }, []);

  const handleVoiceSettingsChange = useCallback((next: Partial<VoiceSettings>) => {
    setVoiceSettings((current) => {
      const merged = normalizeVoiceSettings({ ...current, ...next });
      sessionRef.current?.setVoiceSettings(merged);
      return merged;
    });
  }, []);

  const handleBreak = useCallback(() => {
    canvasRef.current?.breakBlock();
  }, []);

  const handlePlace = useCallback(() => {
    canvasRef.current?.placeBlock();
  }, []);

  const handleJump = useCallback(() => {
    canvasRef.current?.jump();
  }, []);

  const handleSave = useCallback(async () => {
    const runtime = canvasRef.current?.getRuntime();
    if (!runtime || saving) return;

    setSaving(true);
    setSaveNotice(null);
    try {
      const chunks = runtime.getModifiedChunkDiffs();
      const snapshot: WorldSnapshot = {
        formatVersion: SNAPSHOT_FORMAT_VERSION,
        theme,
        seed,
        timestampMs: Date.now(),
        sequence: 0,
        chunks
      };
      const binary = serializeSnapshot(snapshot);

      const res = await fetch(`/api/rooms/${roomId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: binary.buffer as ArrayBuffer
      });

      if (res.ok) {
        const data = await res.json();
        const kb = Math.round((data.byteSize ?? 0) / 1024);
        setSaveNotice(`Saved (${kb} KB)`);
        setTimeout(() => setSaveNotice(null), 3000);
      } else {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        setSaveNotice(err.error ?? "Save failed");
        setTimeout(() => setSaveNotice(null), 5000);
      }
    } catch (err) {
      reportError(err, { phase: "save", roomId });
      setSaveNotice(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setSaveNotice(null), 5000);
    } finally {
      setSaving(false);
    }
  }, [roomId, theme, seed, saving]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <VoxelCanvas
        ref={canvasRef}
        theme={theme}
        seed={seed}
        quality={quality}
        onPlayerStateChange={handlePlayerStateChange}
        onBlockEdit={handleBlockEdit}
      />
      <HUD
        network={{
          connectionStatus,
          peerCount,
          roomId
        }}
        voice={{
          permission: voicePermission,
          settings: voiceSettings,
          micActive,
          onEnable: handleEnableVoice,
          onDisable: handleDisableVoice,
          onSettingsChange: handleVoiceSettingsChange
        }}
        save={isHost ? {
          onSave: handleSave,
          saving,
          notice: saveNotice
        } : undefined}
        errorMessage={lastError}
      />
      <TouchControls
        onBreak={handleBreak}
        onPlace={handlePlace}
        onJump={handleJump}
      />
    </div>
  );
}
