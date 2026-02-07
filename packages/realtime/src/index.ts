import { MAX_PLAYERS_PER_ROOM } from "@voxel/domain";
import {
  MAX_REPLICATION_HZ,
  MIN_REPLICATION_HZ,
  PROTOCOL_VERSION,
  blockPositionKey,
  shouldApplyBlockEdit,
  type BlockEditEvent,
  type BlockEditOperation,
  type LateJoinSync,
  type PlayerStateFrame,
  type Vector3,
  type WorldSnapshotPointer
} from "@voxel/protocol";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const TURN_SCHEME_PATTERN = /^turns?:/i;
const STUN_SCHEME_PATTERN = /^stuns?:/i;
const DEFAULT_INTERPOLATION_DELAY_MS = 100;
const DEFAULT_MAX_BUFFERED_FRAMES = 20;

export interface RealtimeChannelNames {
  presence: string;
  signal: string;
  events: string;
}

export interface IceServerCredential {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SessionTransportConfig {
  iceServers: IceServerCredential[];
  iceTransportPolicy?: RTCIceTransportPolicy;
}

export interface SessionPlanInput {
  roomId: string;
  localPeerId: string;
  participantPeerIds: readonly string[];
  transport: SessionTransportConfig;
}

export interface SessionPlanPeer {
  peerId: string;
  initiator: boolean;
}

export interface SessionPlan {
  roomId: string;
  localPeerId: string;
  channels: RealtimeChannelNames;
  peers: SessionPlanPeer[];
  maxPeers: number;
  transport: SessionTransportConfig;
}

export interface InterpolatedPlayerState {
  peerId: string;
  tick: number;
  sampledAtMs: number;
  position: Vector3;
  velocity: Vector3;
  rotation: PlayerStateFrame["rotation"];
}

export interface InterpolationBufferOptions {
  interpolationDelayMs?: number;
  maxBufferedFrames?: number;
}

export interface BlockStateValue {
  operation: BlockEditOperation;
  blockType: number | null;
  sequence: number;
  actorPeerId: string;
  appliedAtMs: number;
}

export interface LateJoinSyncInput {
  roomId: string;
  recipientPeerId: string;
  snapshot: WorldSnapshotPointer;
  currentTimeMs: number;
  blockHistory: readonly BlockEditEvent[];
  replayLimit?: number;
}

export function createRealtimeChannelNames(roomId: string): RealtimeChannelNames {
  const normalizedRoomId = normalizeRoomId(roomId);
  return {
    presence: `presence:room:${normalizedRoomId}`,
    signal: `signal:room:${normalizedRoomId}`,
    events: `events:room:${normalizedRoomId}`
  };
}

export function normalizeRoomId(roomId: string): string {
  const normalized = roomId.trim();
  if (!ROOM_ID_PATTERN.test(normalized)) {
    throw new Error("roomId must match [a-zA-Z0-9_-] and be <= 128 chars");
  }
  return normalized;
}

export function createSessionPlan(input: SessionPlanInput): SessionPlan {
  const localPeerId = normalizePeerId(input.localPeerId);
  const participantPeerIds = normalizeParticipants(
    input.participantPeerIds,
    localPeerId
  );

  validateTransportConfig(input.transport);

  return {
    roomId: normalizeRoomId(input.roomId),
    localPeerId,
    channels: createRealtimeChannelNames(input.roomId),
    peers: participantPeerIds.map((peerId) => ({
      peerId,
      initiator: localPeerId.localeCompare(peerId) < 0
    })),
    maxPeers: MAX_PLAYERS_PER_ROOM,
    transport: input.transport
  };
}

export function normalizeParticipants(
  peerIds: readonly string[],
  localPeerId: string
): string[] {
  const deduped = new Set<string>();
  for (const peerId of peerIds) {
    const normalized = normalizePeerId(peerId);
    if (normalized !== localPeerId) {
      deduped.add(normalized);
    }
  }

  const maxRemotePeers = MAX_PLAYERS_PER_ROOM - 1;
  if (deduped.size > maxRemotePeers) {
    throw new Error(
      `Mesh supports at most ${MAX_PLAYERS_PER_ROOM} players (${maxRemotePeers} remote peers)`
    );
  }

  return Array.from(deduped).sort((left, right) => left.localeCompare(right));
}

export function validateTransportConfig(config: SessionTransportConfig): void {
  const iceServers = config.iceServers ?? [];
  if (iceServers.length === 0) {
    throw new Error("At least one ICE server is required");
  }

  let hasTurnServer = false;
  for (const server of iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      if (TURN_SCHEME_PATTERN.test(url)) {
        hasTurnServer = true;
      }
      if (!TURN_SCHEME_PATTERN.test(url) && !STUN_SCHEME_PATTERN.test(url)) {
        throw new Error(`Unsupported ICE server URL: ${url}`);
      }
    }
  }

  if (!hasTurnServer) {
    throw new Error("TURN is required for Phase 3 reliability gate");
  }
}

export class PlayerInterpolationBuffer {
  private readonly interpolationDelayMs: number;
  private readonly maxBufferedFrames: number;
  private readonly framesByPeer = new Map<string, PlayerStateFrame[]>();

  constructor(options?: InterpolationBufferOptions) {
    this.interpolationDelayMs =
      options?.interpolationDelayMs ?? DEFAULT_INTERPOLATION_DELAY_MS;
    this.maxBufferedFrames =
      options?.maxBufferedFrames ?? DEFAULT_MAX_BUFFERED_FRAMES;
  }

  push(frame: PlayerStateFrame): void {
    const frames = this.framesByPeer.get(frame.peerId) ?? [];
    frames.push(frame);
    frames.sort((left, right) => left.sentAtMs - right.sentAtMs);

    if (frames.length > this.maxBufferedFrames) {
      frames.splice(0, frames.length - this.maxBufferedFrames);
    }

    this.framesByPeer.set(frame.peerId, frames);
  }

  sample(peerId: string, renderTimeMs: number): InterpolatedPlayerState | null {
    const frames = this.framesByPeer.get(peerId);
    if (!frames || frames.length === 0) {
      return null;
    }

    if (frames.length === 1) {
      return frameToInterpolated(frames[0], renderTimeMs);
    }

    const targetTimeMs = renderTimeMs - this.interpolationDelayMs;
    let previous = frames[0];
    let next = frames[frames.length - 1];

    for (let index = 0; index < frames.length - 1; index += 1) {
      const first = frames[index];
      const second = frames[index + 1];
      if (first.sentAtMs <= targetTimeMs && second.sentAtMs >= targetTimeMs) {
        previous = first;
        next = second;
        break;
      }
    }

    if (targetTimeMs <= previous.sentAtMs) {
      return frameToInterpolated(previous, renderTimeMs);
    }

    if (targetTimeMs >= next.sentAtMs) {
      return frameToInterpolated(next, renderTimeMs);
    }

    const range = next.sentAtMs - previous.sentAtMs;
    const alpha = range === 0 ? 0 : (targetTimeMs - previous.sentAtMs) / range;

    return {
      peerId,
      tick: next.tick,
      sampledAtMs: renderTimeMs,
      position: lerpVector(previous.position, next.position, alpha),
      velocity: lerpVector(previous.velocity, next.velocity, alpha),
      rotation: {
        yaw: lerp(previous.rotation.yaw, next.rotation.yaw, alpha),
        pitch: lerp(previous.rotation.pitch, next.rotation.pitch, alpha),
        roll: lerp(previous.rotation.roll, next.rotation.roll, alpha)
      }
    };
  }

  sampleAll(renderTimeMs: number): Map<string, InterpolatedPlayerState> {
    const result = new Map<string, InterpolatedPlayerState>();
    for (const peerId of this.framesByPeer.keys()) {
      const sample = this.sample(peerId, renderTimeMs);
      if (sample) {
        result.set(peerId, sample);
      }
    }
    return result;
  }

  removePeer(peerId: string): void {
    this.framesByPeer.delete(peerId);
  }

  clear(): void {
    this.framesByPeer.clear();
  }
}

export class HostSequenceAllocator {
  private sequence = 0;

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  reset(sequence = 0): void {
    if (!Number.isInteger(sequence) || sequence < 0) {
      throw new Error("sequence must be a non-negative integer");
    }
    this.sequence = sequence;
  }
}

export function applyHostOrderedBlockEdit(
  state: Map<string, BlockStateValue>,
  event: BlockEditEvent
): boolean {
  const key = blockPositionKey(event.position);
  const previous = state.get(key);
  if (!shouldApplyBlockEdit(previous?.sequence, event.sequence)) {
    return false;
  }

  state.set(key, {
    operation: event.operation,
    blockType: event.blockType,
    sequence: event.sequence,
    actorPeerId: event.actorPeerId,
    appliedAtMs: event.sentAtMs
  });
  return true;
}

export function createLateJoinSync(input: LateJoinSyncInput): LateJoinSync {
  const replayLimit = normalizeReplayLimit(input.replayLimit);
  const replayEvents = input.blockHistory
    .filter((event) => event.sequence > input.snapshot.baseSequence)
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-replayLimit);

  return {
    type: "late-join-sync",
    version: PROTOCOL_VERSION,
    roomId: normalizeRoomId(input.roomId),
    sentAtMs: Math.max(0, Math.trunc(input.currentTimeMs)),
    recipientPeerId: normalizePeerId(input.recipientPeerId),
    snapshot: input.snapshot,
    replayEvents
  };
}

export function resolveReplicationHz(hz: number): number {
  const rounded = Math.round(hz);
  if (rounded < MIN_REPLICATION_HZ || rounded > MAX_REPLICATION_HZ) {
    throw new Error(
      `Replication rate must be ${MIN_REPLICATION_HZ}-${MAX_REPLICATION_HZ} Hz`
    );
  }
  return rounded;
}

function normalizePeerId(peerId: string): string {
  const normalized = peerId.trim();
  if (!normalized || normalized.length > 128) {
    throw new Error("peerId must be between 1 and 128 characters");
  }
  return normalized;
}

function normalizeReplayLimit(limit: number | undefined): number {
  const resolved = limit ?? 500;
  if (!Number.isInteger(resolved) || resolved <= 0 || resolved > 2000) {
    throw new Error("replayLimit must be an integer between 1 and 2000");
  }
  return resolved;
}

function frameToInterpolated(
  frame: PlayerStateFrame,
  sampledAtMs: number
): InterpolatedPlayerState {
  return {
    peerId: frame.peerId,
    tick: frame.tick,
    sampledAtMs,
    position: frame.position,
    velocity: frame.velocity,
    rotation: frame.rotation
  };
}

function lerp(left: number, right: number, alpha: number): number {
  const t = Math.min(1, Math.max(0, alpha));
  return left + (right - left) * t;
}

function lerpVector(left: Vector3, right: Vector3, alpha: number): Vector3 {
  return {
    x: lerp(left.x, right.x, alpha),
    y: lerp(left.y, right.y, alpha),
    z: lerp(left.z, right.z, alpha)
  };
}
