"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PlayerState } from "@voxel/engine";
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
  onError?: (message: string) => void;
}

interface PeerState {
  initiator: boolean;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
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
  private replicationTimer: ReturnType<typeof setInterval> | null = null;
  private interpolationTimer: ReturnType<typeof setInterval> | null = null;
  private fetchedIceServers: RTCIceServer[] | null = null;

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
      await this.fetchIceServers();
      await this.setupChannels();
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
  }

  async enableVoice(): Promise<void> {
    if (!this.running || this.localStream) {
      return;
    }

    const permission = await getMicrophonePermissionState(navigator);
    this.setVoicePermission(permission);
    this.audioContext = this.audioContext ?? new AudioContext();
    await this.audioContext.resume();

    const result = await requestMicrophoneStream(navigator);
    this.setVoicePermission(result.permission);
    if (!result.ok) {
      this.options.onError?.(result.reason);
      return;
    }

    this.localStream = result.stream;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.voiceSettings.muted;
    }

    for (const [peerId, peer] of this.peers.entries()) {
      this.addLocalAudioToPeer(peerId, peer);
      if (peer.initiator) {
        this.createAndSendOffer(peerId).catch((error) => {
          this.options.onError?.(
            error instanceof Error ? error.message : "Failed to renegotiate audio stream"
          );
        });
      }
    }

    this.hydrateRemoteVoiceGraphs();
  }

  disableVoice(): void {
    if (!this.localStream) {
      return;
    }

    for (const track of this.localStream.getTracks()) {
      track.stop();
    }
    this.localStream = null;
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
          dataChannel: null
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

    const presentPeers = new Set(plan.peers.map((peer) => peer.peerId));
    for (const peerId of this.peers.keys()) {
      if (!presentPeers.has(peerId)) {
        this.disconnectPeer(peerId);
        this.peers.delete(peerId);
      }
    }

    this.setPeerCount(this.peers.size);
  }

  private createPeerConnection(peerId: string, initiator: boolean): RTCPeerConnection {
    const connection = new RTCPeerConnection(this.getTransportConfig());

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
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
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.disconnectPeer(peerId);
        this.peers.delete(peerId);
        this.setPeerCount(this.peers.size);
      }
    };

    connection.ondatachannel = (event) => {
      this.attachDataChannel(peerId, event.channel);
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

      this.remoteStreamByPeer.set(peerId, stream);
      if (this.localStream) {
        this.hydrateRemoteVoiceGraph(peerId, stream);
      }
    };

    this.addLocalAudioToPeer(peerId, { connection, initiator, dataChannel: null });
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
    if (!this.peers.has(message.fromPeerId)) {
      const connection = this.createPeerConnection(message.fromPeerId, false);
      this.peers.set(message.fromPeerId, {
        initiator: false,
        connection,
        dataChannel: null
      });
      this.setPeerCount(this.peers.size);
    }

    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    await peer.connection.setRemoteDescription({ type: "offer", sdp: message.sdp });
    this.addLocalAudioToPeer(message.fromPeerId, peer);
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    await this.sendSignal({
      type: "answer",
      toPeerId: message.fromPeerId,
      sdp: answer.sdp ?? ""
    });
  }

  private async handleAnswer(
    message: Extract<SignalingMessage, { type: "answer" }>
  ): Promise<void> {
    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    await peer.connection.setRemoteDescription({ type: "answer", sdp: message.sdp });
  }

  private async handleIceCandidate(
    message: Extract<SignalingMessage, { type: "ice-candidate" }>
  ): Promise<void> {
    const peer = this.peers.get(message.fromPeerId);
    if (!peer) {
      return;
    }

    await peer.connection.addIceCandidate({
      candidate: message.candidate,
      sdpMid: message.sdpMid,
      sdpMLineIndex: message.sdpMLineIndex
    });
  }

  private async createAndSendOffer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
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
    for (const [peerId, sample] of samples.entries()) {
      this.remotePoseByPeer.set(peerId, {
        ...sample,
        type: "player-state",
        roomId: this.options.roomId,
        version: PROTOCOL_VERSION,
        sentAtMs: sample.sampledAtMs
      });
    }

    this.updateSpatialAudio();
  }

  private updateSpatialAudio(): void {
    if (!this.audioContext) {
      return;
    }

    const localPose = this.poseFromPlayerState(this.localState);
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
  }

  private async fetchIceServers(): Promise<void> {
    const apiUrl = this.options.turn.apiUrl;
    if (!apiUrl) {
      return;
    }

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        console.warn("[webrtc] Failed to fetch ICE servers:", res.status);
        return;
      }
      const servers: RTCIceServer[] = await res.json();
      if (Array.isArray(servers) && servers.length > 0) {
        this.fetchedIceServers = servers;
      }
    } catch (err) {
      console.warn("[webrtc] Error fetching ICE servers:", err);
    }
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

  private setStatus(status: RealtimeConnectionStatus): void {
    this.options.onConnectionStatusChange?.(status);
  }

  private setPeerCount(count: number): void {
    this.options.onPeerCountChange?.(count);
  }

  private setVoicePermission(permission: MicrophonePermissionState): void {
    this.voicePermission = permission;
    this.options.onVoicePermissionChange?.(permission);
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
