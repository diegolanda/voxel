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
