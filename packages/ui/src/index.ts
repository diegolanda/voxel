export const UI_PACKAGE_READY = true;

export interface VoiceHudViewModel {
  muted: boolean;
  volume: number;
  proximityRadius: number;
  permission: "granted" | "denied" | "prompt" | "unsupported";
}

export interface VoiceHudControlHandlers {
  onToggleMute(): void;
  onVolumeChange(nextVolume: number): void;
  onProximityRadiusChange(nextRadius: number): void;
}
