"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MvpTheme } from "@voxel/domain";
import type { PlayerState } from "@voxel/engine";
import {
  DEFAULT_VOICE_SETTINGS,
  normalizeVoiceSettings,
  type MicrophonePermissionState,
  type VoiceSettings
} from "@voxel/voice";
import { VoxelCanvas } from "../../../components/game/VoxelCanvas";
import { HUD } from "../../../components/game/HUD";
import { TouchControls } from "../../../components/game/TouchControls";
import { useGameStore } from "../../../store/game-store";
import {
  RoomRealtimeSession,
  type RealtimeConnectionStatus,
  type RoomTurnConfig
} from "../../../lib/realtime/room-realtime-session";

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
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>("idle");
  const [peerCount, setPeerCount] = useState(0);
  const [voicePermission, setVoicePermission] =
    useState<MicrophonePermissionState>("prompt");
  const [voiceSettings, setVoiceSettings] =
    useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [lastError, setLastError] = useState<string | null>(null);

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

  useEffect(() => {
    const session = new RoomRealtimeSession({
      ...sessionConfig,
      onConnectionStatusChange: setConnectionStatus,
      onPeerCountChange: setPeerCount,
      onVoicePermissionChange: setVoicePermission,
      onError: setLastError
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

  const handleEnableVoice = useCallback(() => {
    void sessionRef.current?.enableVoice();
  }, []);

  const handleDisableVoice = useCallback(() => {
    sessionRef.current?.disableVoice();
  }, []);

  const handleVoiceSettingsChange = useCallback((next: Partial<VoiceSettings>) => {
    setVoiceSettings((current) => {
      const merged = normalizeVoiceSettings({ ...current, ...next });
      sessionRef.current?.setVoiceSettings(merged);
      return merged;
    });
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <VoxelCanvas
        theme={theme}
        seed={seed}
        quality={quality}
        onPlayerStateChange={handlePlayerStateChange}
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
          onEnable: handleEnableVoice,
          onDisable: handleDisableVoice,
          onSettingsChange: handleVoiceSettingsChange
        }}
        errorMessage={lastError}
      />
      <TouchControls />
    </div>
  );
}
