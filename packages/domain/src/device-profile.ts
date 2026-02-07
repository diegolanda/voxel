import type { QualityPreset } from "./index";

// ── Device profiling & quality recommendation ────────────────────────

export interface DeviceProfile {
  devicePixelRatio: number;
  hardwareConcurrency: number;
  isTouch: boolean;
  screenWidth: number;
  screenHeight: number;
  isIPad: boolean;
}

export function detectDeviceProfile(): DeviceProfile {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isTouch =
    typeof navigator !== "undefined" && "maxTouchPoints" in navigator
      ? navigator.maxTouchPoints > 0
      : false;
  const screenWidth =
    typeof screen !== "undefined" ? screen.width : 1920;
  const screenHeight =
    typeof screen !== "undefined" ? screen.height : 1080;
  const isIPad =
    /iPad/i.test(ua) ||
    (isTouch && /Macintosh/i.test(ua) && screenWidth >= 768);

  return {
    devicePixelRatio:
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
    hardwareConcurrency:
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4,
    isTouch,
    screenWidth,
    screenHeight,
    isIPad,
  };
}

export function recommendQualityPreset(profile: DeviceProfile): QualityPreset {
  // iPad or low-core touch devices → low
  if (profile.isIPad || (profile.isTouch && profile.hardwareConcurrency <= 4)) {
    return "low";
  }

  // Desktop with high-end specs → high
  if (
    !profile.isTouch &&
    profile.hardwareConcurrency >= 8 &&
    profile.devicePixelRatio >= 1.5 &&
    profile.screenWidth >= 1920
  ) {
    return "high";
  }

  return "medium";
}
