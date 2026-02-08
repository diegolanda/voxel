export interface VoiceSettings {
  muted: boolean;
  volume: number;
  proximityRadius: number;
}

export type MicrophonePermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

export type MicrophoneRequestErrorCode =
  | "unsupported"
  | "permission-denied"
  | "device-unavailable"
  | "unknown";

export interface VoiceHudState {
  settings: VoiceSettings;
  permission: MicrophonePermissionState;
}

export interface VoicePosition {
  x: number;
  y: number;
  z: number;
}

export interface VoiceOrientation {
  x: number;
  y: number;
  z: number;
}

export interface VoicePose {
  position: VoicePosition;
  forward?: VoiceOrientation;
}

export interface VoiceSmoothingConfig {
  positionAlpha: number;
  gainAlpha: number;
}

export interface SpatialVoiceOptions {
  gain: number;
  maxDistance: number;
  refDistance: number;
  rolloffFactor: number;
  panningModel: PanningModelType;
  distanceModel: DistanceModelType;
}

export interface SpatialVoiceGraph {
  source: MediaStreamAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
  analyser: AnalyserNode;
}

export type VoiceSettingsAction =
  | { type: "toggle-mute" }
  | { type: "set-muted"; muted: boolean }
  | { type: "set-volume"; volume: number }
  | { type: "set-proximity-radius"; proximityRadius: number };

export type MicrophoneRequestResult =
  | {
      ok: true;
      stream: MediaStream;
      permission: Exclude<MicrophonePermissionState, "unsupported">;
    }
  | {
      ok: false;
      permission: MicrophonePermissionState;
      code: MicrophoneRequestErrorCode;
      reason: string;
    };

export const VOICE_VOLUME_MIN = 0;
export const VOICE_VOLUME_MAX = 1;
export const VOICE_DEFAULT_VOLUME = 1;
export const VOICE_DEFAULT_PROXIMITY_RADIUS = 60;
export const VOICE_MIN_PROXIMITY_RADIUS = 5;
export const VOICE_MAX_PROXIMITY_RADIUS = 100;
/** Spatial attenuation floor — players are always at least 25% audible. */
export const VOICE_MIN_SPATIAL_GAIN = 0.25;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  muted: false,
  volume: VOICE_DEFAULT_VOLUME,
  proximityRadius: VOICE_DEFAULT_PROXIMITY_RADIUS
};

export const DEFAULT_VOICE_HUD_STATE: VoiceHudState = {
  settings: DEFAULT_VOICE_SETTINGS,
  permission: "prompt"
};

export const DEFAULT_VOICE_SMOOTHING: VoiceSmoothingConfig = {
  positionAlpha: 0.35,
  gainAlpha: 0.2
};

export const DEFAULT_SPATIAL_VOICE_OPTIONS: SpatialVoiceOptions = {
  gain: 1,
  maxDistance: VOICE_DEFAULT_PROXIMITY_RADIUS,
  refDistance: 3,
  rolloffFactor: 0.7,
  panningModel: "HRTF",
  distanceModel: "inverse"
};

export function clampVoiceVolume(value: number): number {
  return clamp(value, VOICE_VOLUME_MIN, VOICE_VOLUME_MAX);
}

export function clampVoiceProximityRadius(value: number): number {
  return clamp(value, VOICE_MIN_PROXIMITY_RADIUS, VOICE_MAX_PROXIMITY_RADIUS);
}

export function normalizeVoiceSettings(
  settings: Partial<VoiceSettings>
): VoiceSettings {
  return {
    muted: settings.muted ?? DEFAULT_VOICE_SETTINGS.muted,
    volume: clampVoiceVolume(settings.volume ?? DEFAULT_VOICE_SETTINGS.volume),
    proximityRadius: clampVoiceProximityRadius(
      settings.proximityRadius ?? DEFAULT_VOICE_SETTINGS.proximityRadius
    )
  };
}

export function reduceVoiceSettings(
  state: VoiceSettings,
  action: VoiceSettingsAction
): VoiceSettings {
  switch (action.type) {
    case "toggle-mute":
      return { ...state, muted: !state.muted };
    case "set-muted":
      return { ...state, muted: action.muted };
    case "set-volume":
      return { ...state, volume: clampVoiceVolume(action.volume) };
    case "set-proximity-radius":
      return {
        ...state,
        proximityRadius: clampVoiceProximityRadius(action.proximityRadius)
      };
    default:
      return state;
  }
}

export async function getMicrophonePermissionState(
  navigatorLike: Pick<Navigator, "mediaDevices" | "permissions">
): Promise<MicrophonePermissionState> {
  if (!navigatorLike.mediaDevices?.getUserMedia) {
    return "unsupported";
  }

  try {
    if (!navigatorLike.permissions?.query) {
      return "prompt";
    }

    const result = await navigatorLike.permissions.query({
      name: "microphone" as PermissionName
    });
    if (result.state === "granted" || result.state === "denied") {
      return result.state;
    }

    return "prompt";
  } catch {
    return "prompt";
  }
}

export async function requestMicrophoneStream(
  navigatorLike: Pick<Navigator, "mediaDevices" | "permissions">,
  constraints?: MediaTrackConstraints
): Promise<MicrophoneRequestResult> {
  if (!navigatorLike.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      permission: "unsupported",
      code: "unsupported",
      reason: "Microphone capture is not supported in this browser"
    };
  }

  try {
    const stream = await navigatorLike.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        ...constraints
      },
      video: false
    });
    const permission = await getMicrophonePermissionState(navigatorLike);
    return {
      ok: true,
      stream,
      permission: permission === "unsupported" ? "prompt" : permission
    };
  } catch (error) {
    const permission = await getMicrophonePermissionState(navigatorLike);
    const normalizedPermission =
      permission === "unsupported" ? "prompt" : permission;
    const { code, reason } = mapMicrophoneError(error);
    return {
      ok: false,
      permission: normalizedPermission,
      code,
      reason
    };
  }
}

export function createSpatialVoiceGraph(
  context: AudioContext,
  stream: MediaStream,
  destination: AudioNode = context.destination,
  options: Partial<SpatialVoiceOptions> = {}
): SpatialVoiceGraph {
  const resolvedOptions: SpatialVoiceOptions = {
    ...DEFAULT_SPATIAL_VOICE_OPTIONS,
    ...options
  };

  const source = context.createMediaStreamSource(stream);
  const panner = context.createPanner();
  panner.panningModel = resolvedOptions.panningModel;
  panner.distanceModel = resolvedOptions.distanceModel;
  panner.refDistance = resolvedOptions.refDistance;
  panner.maxDistance = resolvedOptions.maxDistance;
  // Disable PannerNode's built-in distance attenuation — we compute it
  // manually in updateSpatialVoicePose so we can enforce a minimum gain floor.
  // HRTF directional panning still works with rolloffFactor = 0.
  panner.rolloffFactor = 0;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 0;

  const gain = context.createGain();
  gain.gain.value = clampVoiceVolume(resolvedOptions.gain);

  // Analyser taps the raw source output (before panner/gain) so we can
  // verify whether the WebRTC stream is actually delivering audio samples.
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;

  source.connect(analyser);
  analyser.connect(panner);
  panner.connect(gain);
  gain.connect(destination);

  return { source, panner, gain, analyser };
}

/**
 * Read the current audio level from a voice graph's analyser node.
 * Returns `{ peak, rms }` in the range [0, 1].  Both will be 0 when the
 * remote stream has no audio flowing.
 */
export function readVoiceAudioLevel(graph: SpatialVoiceGraph): { peak: number; rms: number } {
  const buf = new Uint8Array(graph.analyser.frequencyBinCount);
  graph.analyser.getByteTimeDomainData(buf);

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) {
    // Byte domain data is unsigned 0-255 with 128 = silence.
    const sample = (buf[i] - 128) / 128;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSq += sample * sample;
  }

  return { peak, rms: Math.sqrt(sumSq / buf.length) };
}

export function updateSpatialVoicePose(
  graph: SpatialVoiceGraph,
  localPose: VoicePose,
  remotePose: VoicePose,
  settings: VoiceSettings,
  context: BaseAudioContext,
  smoothing: VoiceSmoothingConfig = DEFAULT_VOICE_SMOOTHING
): void {
  const dx = remotePose.position.x - localPose.position.x;
  const dy = remotePose.position.y - localPose.position.y;
  const dz = remotePose.position.z - localPose.position.z;
  const time = context.currentTime;

  setAudioParam(graph.panner.positionX, dx, time, smoothing.positionAlpha);
  setAudioParam(graph.panner.positionY, dy, time, smoothing.positionAlpha);
  setAudioParam(graph.panner.positionZ, dz, time, smoothing.positionAlpha);

  const forward = remotePose.forward ?? { x: 0, y: 0, z: 1 };
  setAudioParam(
    graph.panner.orientationX,
    forward.x,
    time,
    smoothing.positionAlpha
  );
  setAudioParam(
    graph.panner.orientationY,
    forward.y,
    time,
    smoothing.positionAlpha
  );
  setAudioParam(
    graph.panner.orientationZ,
    forward.z,
    time,
    smoothing.positionAlpha
  );

  // Keep panner maxDistance in sync with user's proximity radius setting.
  graph.panner.maxDistance = Math.max(1, settings.proximityRadius);

  // Compute distance attenuation manually (PannerNode rolloff is disabled)
  // so we can enforce VOICE_MIN_SPATIAL_GAIN as a floor — players are always
  // audible regardless of distance.  Mute only controls the local mic track.
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ref = DEFAULT_SPATIAL_VOICE_OPTIONS.refDistance;
  const maxDist = Math.max(1, settings.proximityRadius);
  const rolloff = DEFAULT_SPATIAL_VOICE_OPTIONS.rolloffFactor;
  const clamped = clamp(distance, ref, maxDist);
  const distanceGain = ref / (ref + rolloff * (clamped - ref));
  const spatialGain = Math.max(VOICE_MIN_SPATIAL_GAIN, distanceGain);
  const finalGain = clampVoiceVolume(settings.volume) * spatialGain;
  setAudioParam(graph.gain.gain, finalGain, time, smoothing.gainAlpha);
}

function setAudioParam(
  param: AudioParam,
  value: number,
  time: number,
  alpha: number
): void {
  const smoothing = clamp(alpha, 0, 1);
  if (smoothing <= 0) {
    param.value = value;
    return;
  }

  const timeConstant = 1 - smoothing;
  param.setTargetAtTime(value, time, Math.max(0.0001, timeConstant));
}

function mapMicrophoneError(error: unknown): {
  code: MicrophoneRequestErrorCode;
  reason: string;
} {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return { code: "permission-denied", reason: "User denied microphone permission" };
    }
    if (
      error.name === "NotFoundError" ||
      error.name === "NotReadableError" ||
      error.name === "OverconstrainedError"
    ) {
      return { code: "device-unavailable", reason: "No usable microphone device" };
    }
    return { code: "unknown", reason: error.message || "Failed to capture microphone" };
  }

  return { code: "unknown", reason: "Failed to capture microphone" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
