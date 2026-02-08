"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PlayerState, RemotePlayerState, BlockEditInfo } from "@voxel/engine";
import {
  createRealtimeChannelNames,
  createSessionPlan,
  resolveReplicationHz,
  PlayerInterpolationBuffer,
  type SessionTransportConfig
} from "@voxel/realtime";
import {
  PROTOCOL_VERSION,
  parsePlayerStateFrame,
  parseSignalingMessage,
  type ChannelPresenceState,
  type PlayerStateFrame,
  type SignalingMessage
} from "@voxel/protocol";
import {
  DEFAULT_VOICE_SETTINGS,
  normalizeVoiceSettings,
  requestMicrophoneStream,
  getMicrophonePermissionState,
  createSpatialVoiceGraph,
  updateSpatialVoicePose,
  type VoiceSettings,
  type MicrophonePermissionState,
  type SpatialVoiceGraph
} from "@voxel/voice";
import { createBrowserSupabaseClient } from "../supabase/browser";

export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface RoomTurnConfig {
  /** Metered (or compatible) REST endpoint that returns an ICE servers array. */
  apiUrl?: string;
}

export interface RoomRealtimeSessionOptions {
  roomId: string;
  userId: string;
  displayName: string;
  isHost: boolean;
  turn: RoomTurnConfig;
  replicationHz?: number;
  onConnectionStatusChange?: (status: RealtimeConnectionStatus) => void;
  onPeerCountChange?: (count: number) => void;
  onVoicePermissionChange?: (permission: MicrophonePermissionState) => void;
  onRemotePlayersChange?: (states: Map<string, RemotePlayerState>) => void;
  onRemoteBlockEdit?: (edit: BlockEditInfo) => void;
  onError?: (message: string) => void;
}

interface PeerState {
  initiator: boolean;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  pendingIceCandidates: RTCIceCandidateInit[];
}

interface RemoteVoiceState {
  stream: MediaStream;
  graph: SpatialVoiceGraph;
}

type OutboundSignalingPayload =
  | {
      type: "offer";
      toPeerId: string | null;
      sdp: string;
    }
  | {
      type: "answer";
      toPeerId: string | null;
      sdp: string;
    }
  | {
      type: "ice-candidate";
      toPeerId: string | null;
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    };

export class RoomRealtimeSession {
  private readonly options: RoomRealtimeSessionOptions;
  private readonly supabase = createBrowserSupabaseClient();
  private readonly localPeerId = crypto.randomUUID();
  private readonly channels: ReturnType<typeof createRealtimeChannelNames>;
  private readonly peers = new Map<string, PeerState>();
  private readonly interpolationBuffer = new PlayerInterpolationBuffer();
  private readonly remotePoseByPeer = new Map<string, PlayerStateFrame>();
  private readonly remoteStreamByPeer = new Map<string, MediaStream>();
  private readonly remoteVoiceByPeer = new Map<string, RemoteVoiceState>();
  private readonly replicationHz: number;

  private presenceChannel: RealtimeChannel | null = null;
  private signalChannel: RealtimeChannel | null = null;
  private eventsChannel: RealtimeChannel | null = null;

  private localState: PlayerState = {
    position: [0, 0, 0],
    rotation: [0, 0],
    velocity: [0, 0, 0],
    onGround: false
  };
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private voicePermission: MicrophonePermissionState = "prompt";
  private voiceSettings: VoiceSettings = DEFAULT_VOICE_SETTINGS;
  private running = false;
  private tick = 0;
  private blockSequence = 0;
  private readonly blockEditLog: BlockEditInfo[] = [];
  private readonly knownPeerIds = new Set<string>();
  private readonly debugVoice = shouldEnableVoiceDebug();
  private replicationTimer: ReturnType<typeof setInterval> | null = null;
  private interpolationTimer: ReturnType<typeof setInterval> | null = null;
  private fetchedIceServers: RTCIceServer[] | null = null;
  private removeAudioUnlockHandlers: (() => void) | null = null;

  constructor(options: RoomRealtimeSessionOptions) {
    this.options = options;
    this.channels = createRealtimeChannelNames(this.options.roomId);
    this.replicationHz = resolveReplicationHz(options.replicationHz ?? 15);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.setStatus("connecting");

    try {
      this.logVoice("session:start", {
        roomId: this.options.roomId,
        turnApiUrl: this.options.turn.apiUrl ?? "/api/turn/credentials"
      });
      await this.fetchIceServers();
      await this.setupChannels();
      await this.ensureAudioContext();
      this.startLoops();
      this.setStatus("connected");
    } catch (error) {
      this.options.onError?.(
        error instanceof Error ? error.message : "Failed to initialize realtime session"
      );
      await this.stop();
      this.setStatus("error");
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.logVoice("session:stop");

    if (this.replicationTimer) {
      clearInterval(this.replicationTimer);
      this.replicationTimer = null;
    }
    if (this.interpolationTimer) {
      clearInterval(this.interpolationTimer);
      this.interpolationTimer = null;
    }

    for (const peerId of this.peers.keys()) {
      this.disconnectPeer(peerId);
    }
    this.peers.clear();
    this.interpolationBuffer.clear();
    this.remotePoseByPeer.clear();

    await Promise.all([
      this.presenceChannel?.unsubscribe(),
      this.signalChannel?.unsubscribe(),
      this.eventsChannel?.unsubscribe()
    ]);
    this.presenceChannel = null;
    this.signalChannel = null;
    this.eventsChannel = null;

    this.disposeVoiceGraphs();
    this.remoteStreamByPeer.clear();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.cleanupAudioUnlockHandlers();

    this.setPeerCount(0);
    this.setStatus("idle");
  }

  updateLocalPlayerState(state: PlayerState): void {
    this.localState = state;
  }

  getVoiceSettings(): VoiceSettings {
    return this.voiceSettings;
  }

  getVoicePermission(): MicrophonePermissionState {
    return this.voicePermission;
  }

  setVoiceSettings(next: Partial<VoiceSettings>): void {
    this.voiceSettings = normalizeVoiceSettings({ ...this.voiceSettings, ...next });

    const muted = this.voiceSettings.muted;
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }

    this.updateSpatialAudio();
    this.logVoice("voice:settings-updated", this.voiceSettings);
  }

  async enableVoice(): Promise<boolean> {
    if (!this.running) {
      return false;
    }

    if (this.localStream) {
      return true;
    }

    const permission = await getMicrophonePermissionState(navigator);
    this.setVoicePermission(permission);
    this.logVoice("voice:permission-before-request", { permission });
    await this.ensureAudioContext();

    const result = await requestMicrophoneStream(navigator);
    this.setVoicePermission(result.permission);
    if (!result.ok) {
      this.logVoice("voice:enable-failed", {
        permission: result.permission,
        code: result.code,
        reason: result.reason
      });
      this.options.onError?.(result.reason);
      return false;
    }

    this.localStream = result.stream;
    this.logVoice("voice:stream-ready", {
      permission: result.permission,
      audioTracks: this.localStream.getAudioTracks().map((t) => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      }))
    });
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.voiceSettings.muted;
    }

    for (const [peerId, peer] of this.peers.entries()) {
      this.addLocalAudioToPeer(peerId, peer);
      this.createAndSendOffer(peerId).catch((error) => {
        this.options.onError?.(
          error instanceof Error ? error.message : "Failed to renegotiate audio stream"
        );
      });
    }

    this.hydrateRemoteVoiceGraphs();
    await this.updateVoicePresence(true);
    this.logVoice("voice:enabled", { peers: Array.from(this.peers.keys()) });
    return true;
  }

  disableVoice(): void {
    if (!this.localStream) {
      return;
    }

    for (const track of this.localStream.getTracks()) {
      track.stop();
    }
    this.logVoice("voice:disabled");
    this.localStream = null;
    void this.updateVoicePresence(false);
  }

  broadcastBlockEdit(edit: BlockEditInfo): void {
    if (!this.eventsChannel) {
      return;
    }

    this.blockSequence += 1;
    this.blockEditLog.push(edit);

    this.eventsChannel.send({
      type: "broadcast",
      event: "block-edit",
      payload: {
        type: "block-edit",
        version: PROTOCOL_VERSION,
        roomId: this.options.roomId,
        sentAtMs: Date.now(),
        actorPeerId: this.localPeerId,
        sequence: this.blockSequence,
        operation: edit.operation,
        position: { x: edit.x, y: edit.y, z: edit.z },
        blockType: edit.operation === "place" ? edit.blockType : null
      }
    });
  }

  private async setupChannels(): Promise<void> {
    this.presenceChannel = this.supabase.channel(this.channels.presence, {
      config: {
        presence: { key: this.localPeerId }
      }
    });
    this.signalChannel = this.supabase.channel(this.channels.signal);
    this.eventsChannel = this.supabase.channel(this.channels.events);

    this.presenceChannel.on("presence", { event: "sync" }, () => {
      this.handlePresenceSync().catch((error) => {
        this.options.onError?.(
          error instanceof Error ? error.message : "Failed to sync realtime presence"
        );
      });
    });

    this.signalChannel.on("broadcast", { event: "signal" }, (payload) => {
      this.handleSignal(payload?.payload).catch((error) => {
        this.options.onError?.(
          error instanceof Error ? error.message : "Failed to process signaling message"
        );
      });
    });

    this.eventsChannel.on("broadcast", { event: "block-edit" }, (payload) => {
      const data = payload?.payload;
      if (!data || data.actorPeerId === this.localPeerId) {
        return;
      }

      const edit: BlockEditInfo = {
        operation: data.operation as "place" | "break",
        x: data.position.x as number,
        y: data.position.y as number,
        z: data.position.z as number,
        blockType: data.operation === "place" ? (data.blockType as number) : 0
      };
      this.blockEditLog.push(edit);
      this.options.onRemoteBlockEdit?.(edit);
    });

    this.eventsChannel.on("broadcast", { event: "world-sync" }, (payload) => {
      const data = payload?.payload;
      if (!data?.edits || !Array.isArray(data.edits)) {
        return;
      }

      for (const edit of data.edits as BlockEditInfo[]) {
        this.options.onRemoteBlockEdit?.(edit);
      }
    });

    await Promise.all([
      subscribeChannel(this.presenceChannel),
      subscribeChannel(this.signalChannel),
      subscribeChannel(this.eventsChannel)
    ]);

    await this.presenceChannel.track({
      peerId: this.localPeerId,
      userId: this.options.userId,
      displayName: this.options.displayName,
      isHost: this.options.isHost,
      voiceEnabled: false,
      joinedAtMs: Date.now()
    } satisfies ChannelPresenceState);
  }

  private async updateVoicePresence(enabled: boolean): Promise<void> {
    if (!this.presenceChannel) {
      return;
    }

    await this.presenceChannel.track({
      peerId: this.localPeerId,
      userId: this.options.userId,
      displayName: this.options.displayName,
      isHost: this.options.isHost,
      voiceEnabled: enabled,
      joinedAtMs: Date.now()
    } satisfies ChannelPresenceState);
    this.logVoice("voice:presence-updated", { enabled });
  }

  private async handlePresenceSync(): Promise<void> {
    if (!this.presenceChannel || !this.running) {
      return;
    }

    const presence = this.presenceChannel.presenceState<ChannelPresenceState>();
    const participantPeerIds = new Set<string>();

    for (const entries of Object.values(presence)) {
      for (const entry of entries ?? []) {
        if (entry.peerId && entry.peerId !== this.localPeerId) {
          participantPeerIds.add(entry.peerId);
        }
      }
    }

    const plan = createSessionPlan({
      roomId: this.options.roomId,
      localPeerId: this.localPeerId,
      participantPeerIds: Array.from(participantPeerIds),
      transport: this.getTransportConfig()
    });

    for (const peer of plan.peers) {
      if (!this.peers.has(peer.peerId)) {
        const connection = this.createPeerConnection(peer.peerId, peer.initiator);
        this.peers.set(peer.peerId, {
          initiator: peer.initiator,
          connection,
          dataChannel: null,
          pendingIceCandidates: []
        });

        if (peer.initiator) {
          const dataChannel = connection.createDataChannel("player-state", {
            ordered: false,
            maxRetransmits: 0
          });
          this.attachDataChannel(peer.peerId, dataChannel);
          this.peers.get(peer.peerId)!.dataChannel = dataChannel;
          await this.createAndSendOffer(peer.peerId);
        }
      }
    }

    // Detect new peers and send world-sync so late joiners get current state.
    // Every peer sends this (setBlock is idempotent, so duplicates are harmless).
    for (const peer of plan.peers) {
      if (!this.knownPeerIds.has(peer.peerId)) {
        this.knownPeerIds.add(peer.peerId);
        if (this.blockEditLog.length > 0) {
          this.sendWorldSync();
        }
      }
    }

    const presentPeers = new Set(plan.peers.map((peer) => peer.peerId));
    for (const peerId of this.peers.keys()) {
      if (!presentPeers.has(peerId)) {
        this.disconnectPeer(peerId);
        this.peers.delete(peerId);
      }
    }

    // Clean up known peer tracking
    for (const peerId of this.knownPeerIds) {
      if (!presentPeers.has(peerId)) {
        this.knownPeerIds.delete(peerId);
      }
    }

    this.setPeerCount(this.peers.size);
  }

  private createPeerConnection(peerId: string, initiator: boolean): RTCPeerConnection {
    const connection = new RTCPeerConnection(this.getTransportConfig());
    this.logVoice("peer:create", {
      peerId,
      initiator,
      iceServers: this.getTransportConfig().iceServers
    });

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        this.logVoice("ice:candidate-complete", { peerId });
        return;
      }
      this.logVoice("ice:local-candidate", {
        peerId,
        type: candidateTypeFromSdp(event.candidate.candidate),
        protocol: event.candidate.protocol,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      });
      void this.sendSignal({
        type: "ice-candidate",
        toPeerId: peerId,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      });
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      this.logVoice("peer:connection-state", { peerId, state });
      if (state === "failed" || state === "closed") {
        this.disconnectPeer(peerId);
        this.peers.delete(peerId);
        this.setPeerCount(this.peers.size);
      }
    };
    connection.oniceconnectionstatechange = () => {
      this.logVoice("peer:ice-connection-state", {
        peerId,
        state: connection.iceConnectionState
      });
    };
    connection.onicegatheringstatechange = () => {
      this.logVoice("peer:ice-gathering-state", {
        peerId,
        state: connection.iceGatheringState
      });
    };
    connection.onsignalingstatechange = () => {
      this.logVoice("peer:signaling-state", {
        peerId,
        state: connection.signalingState
      });
    };

    connection.ondatachannel = (event) => {
      this.attachDataChannel(peerId, event.channel);
      this.logVoice("peer:datachannel-received", {
        peerId,
        label: event.channel.label
      });
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.dataChannel = event.channel;
      }
    };

    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        return;
      }

      this.logVoice("voice:ontrack", {
        peerId,
        streamId: stream.id,
        audioTrackIds: stream.getAudioTracks().map((t) => t.id),
        audioContextState: this.audioContext?.state ?? "none"
      });
      this.remoteStreamByPeer.set(peerId, stream);
      void this.ensureAudioContext().then(() => {
        this.hydrateRemoteVoiceGraph(peerId, stream);
      });
    };

    this.addLocalAudioToPeer(peerId, {
      connection,
      initiator,
      dataChannel: null,
      pendingIceCandidates: []
    });
    return connection;
  }

  private addLocalAudioToPeer(peerId: string, peer: PeerState): void {
    if (!this.localStream) {
      return;
    }

    const existingTrackIds = new Set(
      peer.connection.getSenders().map((sender) => sender.track?.id).filter(Boolean)
    );
    for (const track of this.localStream.getAudioTracks()) {
      if (!existingTrackIds.has(track.id)) {
        peer.connection.addTrack(track, this.localStream);
      }
    }
  }

  private attachDataChannel(peerId: string, channel: RTCDataChannel): void {
    this.logVoice("peer:datachannel-attached", { peerId, label: channel.label });
    channel.onopen = () => {
      this.logVoice("peer:datachannel-open", { peerId, label: channel.label });
    };
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      try {
        const parsed = parsePlayerStateFrame(JSON.parse(event.data));
        this.interpolationBuffer.push(parsed);
      } catch {
        // Ignore invalid payloads from unsupported clients.
      }
    };

    channel.onclose = () => {
      this.logVoice("peer:datachannel-close", { peerId, label: channel.label });
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.dataChannel = null;
      }
    };
  }

  private async handleSignal(payload: unknown): Promise<void> {
    const message = parseSignalingMessage(payload);
    if (message.fromPeerId === this.localPeerId) {
      return;
    }
    if (message.toPeerId && message.toPeerId !== this.localPeerId) {
      return;
    }

    this.logVoice("signal:received", {
      type: message.type,
      fromPeerId: message.fromPeerId,
      toPeerId: message.toPeerId
    });
    switch (message.type) {
      case "offer":
        await this.handleOffer(message);
        break;
      case "answer":
        await this.handleAnswer(message);
        break;
      case "ice-candidate":
        await this.handleIceCandidate(message);
        break;
      default:
        break;
    }
  }

  private async handleOffer(message: Extract<SignalingMessage, { type: "offer" }>): Promise<void> {
    this.logVoice("signal:handle-offer", {
      fromPeerId: message.fromPeerId,
      sdpLength: message.sdp.length
    });
    if (!this.peers.has(message.fromPeerId)) {
      const connection = this.createPeerConnection(message.fromPeerId, false);
      this.peers.set(message.fromPeerId, {
        initiator: false,
        connection,
        dataChannel: null,
        pendingIceCandidates: []
      });
      this.setPeerCount(this.peers.size);
    }

    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    // Roll back any pending local offer to avoid "glare" when both peers
    // send offers simultaneously (e.g. both enabling voice at the same time).
    if (peer.connection.signalingState === "have-local-offer") {
      this.logVoice("signal:offer-glare-rollback", { peerId: message.fromPeerId });
      await peer.connection.setLocalDescription({ type: "rollback" });
    }

    await peer.connection.setRemoteDescription({ type: "offer", sdp: message.sdp });
    await this.flushPendingIceCandidates(message.fromPeerId, peer);
    this.addLocalAudioToPeer(message.fromPeerId, peer);
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    this.logVoice("signal:answer-created", {
      toPeerId: message.fromPeerId,
      sdpLength: answer.sdp?.length ?? 0
    });
    await this.sendSignal({
      type: "answer",
      toPeerId: message.fromPeerId,
      sdp: answer.sdp ?? ""
    });
  }

  private async handleAnswer(
    message: Extract<SignalingMessage, { type: "answer" }>
  ): Promise<void> {
    this.logVoice("signal:handle-answer", {
      fromPeerId: message.fromPeerId,
      sdpLength: message.sdp.length
    });
    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    if (peer.connection.signalingState !== "have-local-offer") {
      this.logVoice("signal:ignore-stale-answer", {
        fromPeerId: message.fromPeerId,
        signalingState: peer.connection.signalingState
      });
      return;
    }

    await peer.connection.setRemoteDescription({ type: "answer", sdp: message.sdp });
    await this.flushPendingIceCandidates(message.fromPeerId, peer);
  }

  private async handleIceCandidate(
    message: Extract<SignalingMessage, { type: "ice-candidate" }>
  ): Promise<void> {
    this.logVoice("ice:remote-candidate", {
      fromPeerId: message.fromPeerId,
      type: candidateTypeFromSdp(message.candidate)
    });
    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    const candidate: RTCIceCandidateInit = {
      candidate: message.candidate,
      sdpMid: message.sdpMid,
      sdpMLineIndex: message.sdpMLineIndex
    };

    if (!peer.connection.remoteDescription) {
      if (peer.pendingIceCandidates.length < 100) {
        peer.pendingIceCandidates.push(candidate);
      }
      this.logVoice("ice:queued-before-remote-description", {
        fromPeerId: message.fromPeerId,
        queued: peer.pendingIceCandidates.length
      });
      return;
    }

    await peer.connection.addIceCandidate(candidate);
  }

  private async createAndSendOffer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    this.logVoice("signal:create-offer", { peerId });
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    this.logVoice("signal:offer-created", {
      peerId,
      sdpLength: offer.sdp?.length ?? 0
    });
    await this.sendSignal({
      type: "offer",
      toPeerId: peerId,
      sdp: offer.sdp ?? ""
    });
  }

  private async sendSignal(payload: OutboundSignalingPayload): Promise<void> {
    if (!this.signalChannel) {
      return;
    }

    const messageBase = {
      roomId: this.options.roomId,
      version: PROTOCOL_VERSION,
      sentAtMs: Date.now(),
      fromPeerId: this.localPeerId
    } as const;

    const message: SignalingMessage =
      payload.type === "offer"
        ? {
            ...messageBase,
            type: "offer",
            toPeerId: payload.toPeerId,
            sdp: payload.sdp
          }
        : payload.type === "answer"
          ? {
              ...messageBase,
              type: "answer",
              toPeerId: payload.toPeerId,
              sdp: payload.sdp
            }
          : {
              ...messageBase,
              type: "ice-candidate",
              toPeerId: payload.toPeerId,
              candidate: payload.candidate,
              sdpMid: payload.sdpMid,
              sdpMLineIndex: payload.sdpMLineIndex
          };

    this.logVoice("signal:send", {
      type: message.type,
      toPeerId: message.toPeerId
    });
    await this.signalChannel.send({
      type: "broadcast",
      event: "signal",
      payload: message
    });
  }

  private startLoops(): void {
    const intervalMs = Math.round(1000 / this.replicationHz);
    this.replicationTimer = setInterval(() => {
      this.broadcastPlayerState();
    }, intervalMs);

    this.interpolationTimer = setInterval(() => {
      this.tickInterpolation();
    }, 50);
  }

  private broadcastPlayerState(): void {
    this.tick += 1;

    const frame: PlayerStateFrame = {
      type: "player-state",
      version: PROTOCOL_VERSION,
      roomId: this.options.roomId,
      sentAtMs: Date.now(),
      tick: this.tick,
      peerId: this.localPeerId,
      position: {
        x: this.localState.position[0],
        y: this.localState.position[1],
        z: this.localState.position[2]
      },
      velocity: {
        x: this.localState.velocity[0],
        y: this.localState.velocity[1],
        z: this.localState.velocity[2]
      },
      rotation: {
        yaw: this.localState.rotation[0],
        pitch: this.localState.rotation[1],
        roll: 0
      }
    };

    const payload = JSON.stringify(frame);
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(payload);
      }
    }
  }

  private tickInterpolation(): void {
    const samples = this.interpolationBuffer.sampleAll(Date.now());
    const remoteStates = new Map<string, RemotePlayerState>();

    for (const [peerId, sample] of samples.entries()) {
      this.remotePoseByPeer.set(peerId, {
        ...sample,
        type: "player-state",
        roomId: this.options.roomId,
        version: PROTOCOL_VERSION,
        sentAtMs: sample.sampledAtMs
      });

      remoteStates.set(peerId, {
        position: [sample.position.x, sample.position.y, sample.position.z],
        rotation: [sample.rotation.yaw, sample.rotation.pitch],
        velocity: [sample.velocity.x, sample.velocity.y, sample.velocity.z],
        isTalking: this.remoteVoiceByPeer.has(peerId)
      });
    }

    this.options.onRemotePlayersChange?.(remoteStates);
    this.updateSpatialAudio();
  }

  private updateSpatialAudio(): void {
    if (!this.audioContext) {
      return;
    }

    const localPose = this.poseFromPlayerState(this.localState);
    const now = this.audioContext.currentTime;
    setAudioParam(this.audioContext.listener.positionX, 0, now, 0.2);
    setAudioParam(this.audioContext.listener.positionY, 0, now, 0.2);
    setAudioParam(this.audioContext.listener.positionZ, 0, now, 0.2);
    setAudioParam(
      this.audioContext.listener.forwardX,
      localPose.forward.x,
      now,
      0.2
    );
    setAudioParam(
      this.audioContext.listener.forwardY,
      localPose.forward.y,
      now,
      0.2
    );
    setAudioParam(
      this.audioContext.listener.forwardZ,
      localPose.forward.z,
      now,
      0.2
    );
    setAudioParam(this.audioContext.listener.upX, 0, now, 0.2);
    setAudioParam(this.audioContext.listener.upY, 1, now, 0.2);
    setAudioParam(this.audioContext.listener.upZ, 0, now, 0.2);

    for (const [peerId, remote] of this.remoteVoiceByPeer.entries()) {
      const remoteState = this.remotePoseByPeer.get(peerId);
      if (!remoteState) {
        continue;
      }

      updateSpatialVoicePose(
        remote.graph,
        localPose,
        this.poseFromFrame(remoteState),
        this.voiceSettings,
        this.audioContext
      );
    }
  }

  private hydrateRemoteVoiceGraphs(): void {
    for (const [peerId, stream] of this.remoteStreamByPeer.entries()) {
      this.hydrateRemoteVoiceGraph(peerId, stream);
    }
  }

  private hydrateRemoteVoiceGraph(peerId: string, stream: MediaStream): void {
    if (!this.audioContext || this.remoteVoiceByPeer.has(peerId)) {
      return;
    }

    const graph = createSpatialVoiceGraph(this.audioContext, stream, this.audioContext.destination, {
      gain: this.voiceSettings.muted ? 0 : this.voiceSettings.volume,
      maxDistance: this.voiceSettings.proximityRadius
    });
    this.remoteVoiceByPeer.set(peerId, { stream, graph });
    this.logVoice("voice:graph-created", {
      peerId,
      streamId: stream.id,
      audioContextState: this.audioContext.state
    });
  }

  private disposeVoiceGraphs(): void {
    for (const remote of this.remoteVoiceByPeer.values()) {
      remote.graph.source.disconnect();
      remote.graph.panner.disconnect();
      remote.graph.gain.disconnect();
    }
    this.remoteVoiceByPeer.clear();
  }

  private disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    try {
      peer.dataChannel?.close();
      peer.connection.close();
    } catch {
      // ignore
    }

    this.interpolationBuffer.removePeer(peerId);
    this.remotePoseByPeer.delete(peerId);
    this.remoteStreamByPeer.delete(peerId);

    const remoteVoice = this.remoteVoiceByPeer.get(peerId);
    if (remoteVoice) {
      remoteVoice.graph.source.disconnect();
      remoteVoice.graph.panner.disconnect();
      remoteVoice.graph.gain.disconnect();
      this.remoteVoiceByPeer.delete(peerId);
    }
    this.logVoice("peer:disconnected", { peerId });
  }

  private async flushPendingIceCandidates(peerId: string, peer: PeerState): Promise<void> {
    if (!peer.connection.remoteDescription || peer.pendingIceCandidates.length === 0) {
      return;
    }

    const queued = peer.pendingIceCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await peer.connection.addIceCandidate(candidate);
      } catch (error) {
        this.logVoice("ice:flush-candidate-failed", {
          peerId,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    this.logVoice("ice:flushed-queued-candidates", { peerId, count: queued.length });
  }

  private async fetchIceServers(): Promise<void> {
    const apiUrl = this.options.turn.apiUrl ?? "/api/turn/credentials";

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        console.warn("[webrtc] Failed to fetch ICE servers:", res.status);
        this.logVoice("ice:fetch-failed", { status: res.status, apiUrl });
        return;
      }
      const servers: RTCIceServer[] = await res.json();
      if (Array.isArray(servers) && servers.length > 0) {
        this.fetchedIceServers = servers;
        this.logVoice("ice:fetch-success", {
          apiUrl,
          iceServers: servers.map((server) => server.urls)
        });
      }
    } catch (err) {
      console.warn("[webrtc] Error fetching ICE servers:", err);
      this.logVoice("ice:fetch-error", {
        apiUrl,
        error: err instanceof Error ? err.message : "unknown"
      });
    }
  }

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
      this.installAudioUnlockHandlers();
      this.logVoice("audio-context:created", { state: this.audioContext.state });
    }

    await this.resumeAudioContextIfNeeded();
    return this.audioContext;
  }

  private async resumeAudioContextIfNeeded(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === "closed") {
      return;
    }
    if (this.audioContext.state === "running") {
      this.hydrateRemoteVoiceGraphs();
      this.cleanupAudioUnlockHandlers();
      this.logVoice("audio-context:already-running");
      return;
    }

    try {
      this.logVoice("audio-context:resume-attempt", {
        state: this.audioContext.state
      });
      await this.audioContext.resume();
    } catch {
      // Will be resumed on the next user gesture.
      this.logVoice("audio-context:resume-blocked");
    }

    const stateAfterResume = this.audioContext.state as AudioContextState;
    if (stateAfterResume === "running") {
      this.hydrateRemoteVoiceGraphs();
      this.cleanupAudioUnlockHandlers();
      this.logVoice("audio-context:running-after-resume");
    } else {
      this.logVoice("audio-context:still-suspended", { state: stateAfterResume });
    }
  }

  private installAudioUnlockHandlers(): void {
    if (this.removeAudioUnlockHandlers || typeof window === "undefined") {
      return;
    }

    const unlock = () => {
      this.logVoice("audio-context:unlock-event");
      void this.resumeAudioContextIfNeeded();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    for (const eventName of events) {
      window.addEventListener(eventName, unlock, { passive: true });
    }

    this.removeAudioUnlockHandlers = () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, unlock);
      }
      this.removeAudioUnlockHandlers = null;
    };
  }

  private cleanupAudioUnlockHandlers(): void {
    this.removeAudioUnlockHandlers?.();
  }

  private getTransportConfig(): SessionTransportConfig {
    const iceServers: SessionTransportConfig["iceServers"] = this.fetchedIceServers
      ? [...this.fetchedIceServers]
      : [{ urls: "stun:stun.l.google.com:19302" }];

    return {
      iceServers,
      iceTransportPolicy: "all"
    };
  }

  private poseFromFrame(frame: PlayerStateFrame): {
    position: { x: number; y: number; z: number };
    forward: { x: number; y: number; z: number };
  } {
    const yaw = frame.rotation.yaw;
    const pitch = frame.rotation.pitch;
    return {
      position: frame.position,
      forward: {
        x: -Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: -Math.cos(yaw) * Math.cos(pitch)
      }
    };
  }

  private poseFromPlayerState(state: PlayerState): {
    position: { x: number; y: number; z: number };
    forward: { x: number; y: number; z: number };
  } {
    const yaw = state.rotation[0];
    const pitch = state.rotation[1];
    return {
      position: {
        x: state.position[0],
        y: state.position[1],
        z: state.position[2]
      },
      forward: {
        x: -Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: -Math.cos(yaw) * Math.cos(pitch)
      }
    };
  }

  private sendWorldSync(): void {
    if (!this.eventsChannel || this.blockEditLog.length === 0) {
      return;
    }

    this.eventsChannel.send({
      type: "broadcast",
      event: "world-sync",
      payload: {
        type: "world-sync",
        version: PROTOCOL_VERSION,
        roomId: this.options.roomId,
        sentAtMs: Date.now(),
        edits: this.blockEditLog
      }
    });
  }

  private setStatus(status: RealtimeConnectionStatus): void {
    this.options.onConnectionStatusChange?.(status);
  }

  private setPeerCount(count: number): void {
    this.options.onPeerCountChange?.(count);
  }

  private setVoicePermission(permission: MicrophonePermissionState): void {
    this.voicePermission = permission;
    this.options.onVoicePermissionChange?.(permission);
    this.logVoice("voice:permission-updated", { permission });
  }

  private logVoice(event: string, details?: unknown): void {
    if (!this.debugVoice) {
      return;
    }

    const peer = this.localPeerId.slice(0, 8);
    if (details === undefined) {
      console.info(`[voice][${peer}] ${event}`);
      return;
    }
    console.info(`[voice][${peer}] ${event}`, details);
  }
}

async function subscribeChannel(channel: RealtimeChannel): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    channel.subscribe((status) => {
      if (settled) {
        return;
      }

      if (status === "SUBSCRIBED") {
        settled = true;
        resolve();
        return;
      }

      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        settled = true;
        reject(new Error(`Channel ${channel.topic} failed to subscribe: ${status}`));
      }
    });
  });
}

function setAudioParam(
  param: AudioParam,
  value: number,
  time: number,
  alpha: number
): void {
  const smoothing = Math.min(1, Math.max(0, alpha));
  if (smoothing <= 0) {
    param.value = value;
    return;
  }

  const timeConstant = 1 - smoothing;
  param.setTargetAtTime(value, time, Math.max(0.0001, timeConstant));
}

function candidateTypeFromSdp(candidate: string): string {
  const match = / typ ([a-zA-Z0-9]+)/.exec(candidate);
  return match?.[1] ?? "unknown";
}

function shouldEnableVoiceDebug(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const query = new URLSearchParams(window.location.search);
    if (query.get("voiceDebug") === "1") {
      return true;
    }
    return window.localStorage.getItem("voiceDebug") === "1";
  } catch {
    return false;
  }
}
