import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;
export const MIN_REPLICATION_HZ = 10;
export const MAX_REPLICATION_HZ = 20;

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const PEER_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/;
const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export const roomIdSchema = z.string().regex(ROOM_ID_PATTERN, {
  message: "roomId must match [a-zA-Z0-9_-] and be <= 128 chars"
});

export const peerIdSchema = z.string().regex(PEER_ID_PATTERN, {
  message: "peerId must match [a-zA-Z0-9:_-] and be <= 128 chars"
});

export const userIdSchema = z.string().regex(USER_ID_PATTERN, {
  message: "userId must match [a-zA-Z0-9_-] and be <= 128 chars"
});

export const protocolEnvelopeSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  roomId: roomIdSchema,
  sentAtMs: z.number().int().nonnegative()
});

const vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite()
});

const eulerSchema = z.object({
  yaw: z.number().finite(),
  pitch: z.number().finite(),
  roll: z.number().finite().default(0)
});

export type Vector3 = z.infer<typeof vector3Schema>;
export type Euler = z.infer<typeof eulerSchema>;

export const channelPresenceStateSchema = z.object({
  peerId: peerIdSchema,
  userId: userIdSchema,
  displayName: z.string().min(1).max(40),
  joinedAtMs: z.number().int().nonnegative(),
  isHost: z.boolean(),
  voiceEnabled: z.boolean()
});

export type ChannelPresenceState = z.infer<typeof channelPresenceStateSchema>;

const signalingBaseSchema = protocolEnvelopeSchema.extend({
  fromPeerId: peerIdSchema,
  toPeerId: peerIdSchema.nullable()
});

export const signalingOfferMessageSchema = signalingBaseSchema.extend({
  type: z.literal("offer"),
  sdp: z.string().min(1)
});

export const signalingAnswerMessageSchema = signalingBaseSchema.extend({
  type: z.literal("answer"),
  sdp: z.string().min(1)
});

export const signalingIceMessageSchema = signalingBaseSchema.extend({
  type: z.literal("ice-candidate"),
  candidate: z.string().min(1),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().int().nullable()
});

export const signalingMessageSchema = z.discriminatedUnion("type", [
  signalingOfferMessageSchema,
  signalingAnswerMessageSchema,
  signalingIceMessageSchema
]);

export type SignalingOfferMessage = z.infer<typeof signalingOfferMessageSchema>;
export type SignalingAnswerMessage = z.infer<typeof signalingAnswerMessageSchema>;
export type SignalingIceMessage = z.infer<typeof signalingIceMessageSchema>;
export type SignalingMessage = z.infer<typeof signalingMessageSchema>;

export const playerStateFrameSchema = protocolEnvelopeSchema.extend({
  type: z.literal("player-state"),
  peerId: peerIdSchema,
  tick: z.number().int().nonnegative(),
  position: vector3Schema,
  velocity: vector3Schema,
  rotation: eulerSchema
});

export type PlayerStateFrame = z.infer<typeof playerStateFrameSchema>;

export const blockEditOperationSchema = z.enum(["place", "break"]);
export type BlockEditOperation = z.infer<typeof blockEditOperationSchema>;

export const blockPositionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int()
});

export type BlockPosition = z.infer<typeof blockPositionSchema>;

export const blockEditEventSchema = protocolEnvelopeSchema
  .extend({
    type: z.literal("block-edit"),
    actorPeerId: peerIdSchema,
    sequence: z.number().int().nonnegative(),
    operation: blockEditOperationSchema,
    position: blockPositionSchema,
    blockType: z.number().int().nonnegative().nullable()
  })
  .superRefine((value, ctx) => {
    if (value.operation === "place" && value.blockType === null) {
      ctx.addIssue({
        code: "custom",
        message: "blockType is required for place operations",
        path: ["blockType"]
      });
    }

    if (value.operation === "break" && value.blockType !== null) {
      ctx.addIssue({
        code: "custom",
        message: "blockType must be null for break operations",
        path: ["blockType"]
      });
    }
  });

export type BlockEditEvent = z.infer<typeof blockEditEventSchema>;

export const lateJoinRequestSchema = protocolEnvelopeSchema.extend({
  type: z.literal("late-join-request"),
  requesterPeerId: peerIdSchema,
  lastKnownSequence: z.number().int().nonnegative().nullable()
});

export type LateJoinRequest = z.infer<typeof lateJoinRequestSchema>;

export const worldSnapshotPointerSchema = z.object({
  snapshotId: z.string().uuid(),
  storagePath: z.string().min(1).max(1024),
  baseSequence: z.number().int().nonnegative(),
  createdAtMs: z.number().int().nonnegative()
});

export type WorldSnapshotPointer = z.infer<typeof worldSnapshotPointerSchema>;

export const lateJoinSyncSchema = protocolEnvelopeSchema.extend({
  type: z.literal("late-join-sync"),
  recipientPeerId: peerIdSchema,
  snapshot: worldSnapshotPointerSchema,
  replayEvents: z.array(blockEditEventSchema)
});

export type LateJoinSync = z.infer<typeof lateJoinSyncSchema>;

export const protocolMessageSchema = z.discriminatedUnion("type", [
  signalingOfferMessageSchema,
  signalingAnswerMessageSchema,
  signalingIceMessageSchema,
  playerStateFrameSchema,
  blockEditEventSchema,
  lateJoinRequestSchema,
  lateJoinSyncSchema
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;

export function parseSignalingMessage(input: unknown): SignalingMessage {
  return signalingMessageSchema.parse(input);
}

export function parsePlayerStateFrame(input: unknown): PlayerStateFrame {
  return playerStateFrameSchema.parse(input);
}

export function parseBlockEditEvent(input: unknown): BlockEditEvent {
  return blockEditEventSchema.parse(input);
}

export function parseLateJoinSync(input: unknown): LateJoinSync {
  return lateJoinSyncSchema.parse(input);
}

export function validateReplicationHz(hz: number): number {
  const rounded = Math.round(hz);
  if (rounded < MIN_REPLICATION_HZ || rounded > MAX_REPLICATION_HZ) {
    throw new Error(
      `Replication rate must be ${MIN_REPLICATION_HZ}-${MAX_REPLICATION_HZ} Hz`
    );
  }

  return rounded;
}

export function blockPositionKey(position: BlockPosition): string {
  return `${position.x},${position.y},${position.z}`;
}

export function shouldApplyBlockEdit(
  previousSequence: number | null | undefined,
  incomingSequence: number
): boolean {
  if (!Number.isInteger(incomingSequence) || incomingSequence < 0) {
    throw new Error("Incoming sequence must be a non-negative integer");
  }

  if (previousSequence === null || previousSequence === undefined) {
    return true;
  }

  return incomingSequence > previousSequence;
}

// ── World Snapshot Binary Format ──────────────────────────────────────
//
// Layout:
//   [Header: 4 + 1 + 1 + 4 + 8 + 4 + 4 + seedLen bytes]
//     magic      u32  "VXS\0" = 0x56585300
//     version    u8   snapshot format version (currently 1)
//     theme      u8   0=forest, 1=snow, 2=coast
//     seedLen    u32  byte length of seed string (UTF-8)
//     seed       u8[] seed bytes
//     timestamp  f64  ms since epoch
//     sequence   u32  host sequence at time of snapshot
//     chunkCount u32  number of chunk diffs following
//   [ChunkDiff: repeated chunkCount times]
//     cx         i32  chunk X coordinate
//     cz         i32  chunk Z coordinate
//     entryCount u32  number of block entries
//     [Entry: repeated entryCount times]
//       localIdx u16  index into flat voxel array (max 16*16*64 = 16384)
//       blockType u8  block type ID

export const SNAPSHOT_MAGIC = 0x56585300;
export const SNAPSHOT_FORMAT_VERSION = 1;

const THEME_TO_INDEX: Record<string, number> = { forest: 0, snow: 1, coast: 2 };
const INDEX_TO_THEME = ["forest", "snow", "coast"] as const;

export interface ChunkDiff {
  cx: number;
  cz: number;
  entries: Array<{ localIndex: number; blockType: number }>;
}

export interface WorldSnapshot {
  formatVersion: number;
  theme: string;
  seed: string;
  timestampMs: number;
  sequence: number;
  chunks: ChunkDiff[];
}

export function serializeSnapshot(snapshot: WorldSnapshot): Uint8Array {
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode(snapshot.seed);

  // Calculate total size
  const headerSize = 4 + 1 + 1 + 4 + seedBytes.length + 8 + 4 + 4;
  let chunksSize = 0;
  for (const chunk of snapshot.chunks) {
    chunksSize += 4 + 4 + 4 + chunk.entries.length * 3; // cx + cz + entryCount + entries
  }

  const buffer = new ArrayBuffer(headerSize + chunksSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Header
  view.setUint32(offset, SNAPSHOT_MAGIC, false); offset += 4;
  view.setUint8(offset, snapshot.formatVersion); offset += 1;
  view.setUint8(offset, THEME_TO_INDEX[snapshot.theme] ?? 0); offset += 1;
  view.setUint32(offset, seedBytes.length, false); offset += 4;
  new Uint8Array(buffer, offset, seedBytes.length).set(seedBytes); offset += seedBytes.length;
  view.setFloat64(offset, snapshot.timestampMs, false); offset += 8;
  view.setUint32(offset, snapshot.sequence, false); offset += 4;
  view.setUint32(offset, snapshot.chunks.length, false); offset += 4;

  // Chunk diffs
  for (const chunk of snapshot.chunks) {
    view.setInt32(offset, chunk.cx, false); offset += 4;
    view.setInt32(offset, chunk.cz, false); offset += 4;
    view.setUint32(offset, chunk.entries.length, false); offset += 4;
    for (const entry of chunk.entries) {
      view.setUint16(offset, entry.localIndex, false); offset += 2;
      view.setUint8(offset, entry.blockType); offset += 1;
    }
  }

  return new Uint8Array(buffer);
}

export function deserializeSnapshot(data: Uint8Array): WorldSnapshot {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  const magic = view.getUint32(offset, false); offset += 4;
  if (magic !== SNAPSHOT_MAGIC) {
    throw new Error("Invalid snapshot: bad magic number");
  }

  const formatVersion = view.getUint8(offset); offset += 1;
  if (formatVersion !== SNAPSHOT_FORMAT_VERSION) {
    throw new Error(`Unsupported snapshot format version: ${formatVersion}`);
  }

  const themeIndex = view.getUint8(offset); offset += 1;
  const theme = INDEX_TO_THEME[themeIndex];
  if (!theme) {
    throw new Error(`Invalid theme index: ${themeIndex}`);
  }

  const seedLen = view.getUint32(offset, false); offset += 4;
  const seedBytes = new Uint8Array(data.buffer, data.byteOffset + offset, seedLen);
  const seed = new TextDecoder().decode(seedBytes); offset += seedLen;

  const timestampMs = view.getFloat64(offset, false); offset += 8;
  const sequence = view.getUint32(offset, false); offset += 4;
  const chunkCount = view.getUint32(offset, false); offset += 4;

  const chunks: ChunkDiff[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const cx = view.getInt32(offset, false); offset += 4;
    const cz = view.getInt32(offset, false); offset += 4;
    const entryCount = view.getUint32(offset, false); offset += 4;
    const entries: ChunkDiff["entries"] = [];
    for (let j = 0; j < entryCount; j++) {
      const localIndex = view.getUint16(offset, false); offset += 2;
      const blockType = view.getUint8(offset); offset += 1;
      entries.push({ localIndex, blockType });
    }
    chunks.push({ cx, cz, entries });
  }

  return { formatVersion, theme, seed, timestampMs, sequence, chunks };
}
