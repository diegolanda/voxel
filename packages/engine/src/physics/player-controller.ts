import { BlockType } from "@voxel/domain";
import type { InputState, PlayerState } from "../types";

const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.004;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 5.6;
const GRAVITY = -32;
const JUMP_VELOCITY = 10;
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const HALF_WIDTH = PLAYER_WIDTH / 2;

export type GetBlockFn = (x: number, y: number, z: number) => BlockType;

export function createPlayerState(spawnX: number, spawnY: number, spawnZ: number): PlayerState {
  return {
    position: [spawnX, spawnY, spawnZ],
    rotation: [0, 0],
    velocity: [0, 0, 0],
    onGround: false,
  };
}

function isSolid(block: BlockType): boolean {
  return block !== BlockType.Air && block !== BlockType.Water;
}

/**
 * Check if a box collides with any solid block.
 * Box defined by min corner (x,y,z) and size (PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH).
 */
function boxCollides(
  minX: number,
  minY: number,
  minZ: number,
  getBlock: GetBlockFn,
): boolean {
  const maxX = minX + PLAYER_WIDTH;
  const maxY = minY + PLAYER_HEIGHT;
  const maxZ = minZ + PLAYER_WIDTH;

  const startX = Math.floor(minX);
  const endX = Math.floor(maxX);
  const startY = Math.floor(minY);
  const endY = Math.floor(maxY);
  const startZ = Math.floor(minZ);
  const endZ = Math.floor(maxZ);

  for (let bx = startX; bx <= endX; bx++) {
    for (let by = startY; by <= endY; by++) {
      for (let bz = startZ; bz <= endZ; bz++) {
        if (isSolid(getBlock(bx, by, bz))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function updatePlayer(
  state: PlayerState,
  input: InputState,
  dt: number,
  getBlock: GetBlockFn,
): PlayerState {
  const [px, py, pz] = state.position;
  let [yaw, pitch] = state.rotation;
  let [vx, vy, vz] = state.velocity;

  // Rotation from mouse/touch deltas
  if (input.pointerLocked) {
    yaw -= input.mouseDeltaX * MOUSE_SENSITIVITY;
    pitch -= input.mouseDeltaY * MOUSE_SENSITIVITY;
  }
  if (input.touchLookDeltaX !== 0 || input.touchLookDeltaY !== 0) {
    yaw -= input.touchLookDeltaX * TOUCH_SENSITIVITY;
    pitch -= input.touchLookDeltaY * TOUCH_SENSITIVITY;
  }
  // Clamp pitch to prevent flipping
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));

  // Movement direction from input
  let moveX = 0;
  let moveZ = 0;
  if (input.forward || input.touchJoystickY > 0.2) moveZ -= 1;
  if (input.backward || input.touchJoystickY < -0.2) moveZ += 1;
  if (input.left || input.touchJoystickX < -0.2) moveX -= 1;
  if (input.right || input.touchJoystickX > 0.2) moveX += 1;

  // Normalize
  const mag = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (mag > 0) {
    moveX /= mag;
    moveZ /= mag;
  }

  // Rotate movement by yaw
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  vx = (moveX * cosYaw - moveZ * sinYaw) * speed;
  vz = (moveX * sinYaw + moveZ * cosYaw) * speed;

  // Gravity
  vy += GRAVITY * dt;

  // Jump
  if (input.jump && state.onGround) {
    vy = JUMP_VELOCITY;
  }

  // AABB collision: resolve each axis independently
  let newX = px;
  let newY = py;
  let newZ = pz;
  let onGround = false;

  // X axis
  newX += vx * dt;
  if (boxCollides(newX - HALF_WIDTH, newY, newZ - HALF_WIDTH, getBlock)) {
    newX = px;
    vx = 0;
  }

  // Z axis
  newZ += vz * dt;
  if (boxCollides(newX - HALF_WIDTH, newY, newZ - HALF_WIDTH, getBlock)) {
    newZ = pz;
    vz = 0;
  }

  // Y axis
  newY += vy * dt;
  if (boxCollides(newX - HALF_WIDTH, newY, newZ - HALF_WIDTH, getBlock)) {
    if (vy < 0) {
      // Landing
      onGround = true;
      newY = Math.floor(py) + 0.001; // Snap to ground
    } else {
      newY = py;
    }
    vy = 0;
  }

  return {
    position: [newX, newY, newZ],
    rotation: [yaw, pitch],
    velocity: [vx, vy, vz],
    onGround,
  };
}
