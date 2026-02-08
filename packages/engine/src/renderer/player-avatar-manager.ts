import * as THREE from "three";
import type { RemotePlayerState } from "../types";
import { SteveModel } from "./steve-model";

/**
 * Manages Steve avatar instances for remote players.
 * Creates, updates, and removes avatars as players join/leave.
 */
export class PlayerAvatarManager {
  private readonly avatars = new Map<string, SteveModel>();
  private readonly parentGroup: THREE.Group;

  constructor(parentGroup: THREE.Group) {
    this.parentGroup = parentGroup;
  }

  /**
   * Sync avatar set with current remote player states.
   * Creates new avatars, updates existing ones, and removes stale ones.
   */
  updateRemotePlayers(
    states: Map<string, RemotePlayerState>,
    dt: number,
  ): void {
    // Remove avatars for players who left
    for (const [peerId, avatar] of this.avatars) {
      if (!states.has(peerId)) {
        this.parentGroup.remove(avatar.group);
        avatar.dispose();
        this.avatars.delete(peerId);
      }
    }

    // Create or update avatars
    for (const [peerId, state] of states) {
      let avatar = this.avatars.get(peerId);
      if (!avatar) {
        avatar = new SteveModel();
        this.avatars.set(peerId, avatar);
        this.parentGroup.add(avatar.group);
      }

      const [px, py, pz] = state.position;
      const [yaw, pitch] = state.rotation;

      avatar.setPosition(px, py, pz);
      avatar.setRotation(yaw);
      avatar.setHeadPitch(pitch);
      avatar.updateAnimation(dt, state.velocity, state.isTalking);
    }
  }

  /** Clean up all avatar resources. */
  dispose(): void {
    for (const [, avatar] of this.avatars) {
      this.parentGroup.remove(avatar.group);
      avatar.dispose();
    }
    this.avatars.clear();
  }
}
