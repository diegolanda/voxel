import * as THREE from "three";

// ── Steve skin color palette ────────────────────────────────────────
const SKIN = "#c8a07e";
const SKIN_SHADOW = "#a0785a";
const HAIR = "#4a3728";
const SHIRT = "#3cbcb2";
const SHIRT_SHADOW = "#2a8a82";
const PANTS = "#3b3b7a";
const PANTS_SHADOW = "#2d2d5e";
const SHOES = "#5a5a5a";
const EYE_WHITE = "#ffffff";
const EYE_IRIS = "#3b3bc8";
const MOUTH = "#7a4a3a";

// ── Proportions (units) ─────────────────────────────────────────────
const HEAD_SIZE = 0.5;
const BODY_W = 0.5;
const BODY_H = 0.75;
const BODY_D = 0.25;
const ARM_W = 0.25;
const ARM_H = 0.75;
const ARM_D = 0.25;
const LEG_W = 0.25;
const LEG_H = 0.75;
const LEG_D = 0.25;

// Animation constants
const WALK_SWING_SPEED = 8;
const WALK_SWING_AMPLITUDE = 0.6; // radians
const TALK_NOD_SPEED = 6;
const TALK_NOD_AMPLITUDE = 0.08;

/**
 * Create a 64x64 procedural Steve skin texture.
 * Each body part gets a dedicated material with face-specific colors.
 */
function createSteveTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Fill background transparent
  ctx.clearRect(0, 0, size, size);

  // ── Head (top-left 32x16 region) ──────────────────────
  // Top of head (hair) — 8x8 starting at (8, 0)
  ctx.fillStyle = HAIR;
  ctx.fillRect(8, 0, 8, 8);

  // Front face — 8x8 starting at (8, 8)
  ctx.fillStyle = SKIN;
  ctx.fillRect(8, 8, 8, 8);

  // Eyes (2px wide each, at row 11-12 from top)
  ctx.fillStyle = EYE_WHITE;
  ctx.fillRect(9, 11, 2, 1);
  ctx.fillRect(13, 11, 2, 1);
  ctx.fillStyle = EYE_IRIS;
  ctx.fillRect(10, 11, 1, 1);
  ctx.fillRect(13, 11, 1, 1);

  // Mouth
  ctx.fillStyle = MOUTH;
  ctx.fillRect(11, 14, 2, 1);

  // Right side (hair/skin mix) — 8x8 starting at (0, 8)
  ctx.fillStyle = HAIR;
  ctx.fillRect(0, 8, 8, 8);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(2, 11, 5, 4);

  // Left side — 8x8 starting at (16, 8)
  ctx.fillStyle = HAIR;
  ctx.fillRect(16, 8, 8, 8);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(17, 11, 5, 4);

  // Back of head (hair) — 8x8 starting at (24, 8)
  ctx.fillStyle = HAIR;
  ctx.fillRect(24, 8, 8, 8);

  // Bottom of head (skin/chin) — 8x8 starting at (16, 0)
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(16, 0, 8, 8);

  // ── Body (row 16-32) ──────────────────────────────────
  // Front — 8x12 starting at (20, 20)
  ctx.fillStyle = SHIRT;
  ctx.fillRect(20, 20, 8, 12);
  // Bottom of shirt darker
  ctx.fillStyle = SHIRT_SHADOW;
  ctx.fillRect(20, 28, 8, 4);

  // Back — 8x12 starting at (32, 20)
  ctx.fillStyle = SHIRT_SHADOW;
  ctx.fillRect(32, 20, 8, 12);

  // Right side — 4x12 starting at (16, 20)
  ctx.fillStyle = SHIRT;
  ctx.fillRect(16, 20, 4, 12);

  // Left side — 4x12 starting at (28, 20)
  ctx.fillStyle = SHIRT;
  ctx.fillRect(28, 20, 4, 12);

  // Top — 8x4 starting at (20, 16)
  ctx.fillStyle = SHIRT;
  ctx.fillRect(20, 16, 8, 4);

  // Bottom — 8x4 starting at (28, 16)
  ctx.fillStyle = SHIRT_SHADOW;
  ctx.fillRect(28, 16, 8, 4);

  // ── Right Arm (row 16-32, col 40-56) ──────────────────
  ctx.fillStyle = SKIN;
  ctx.fillRect(44, 20, 4, 12);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(40, 20, 4, 12);
  ctx.fillRect(48, 20, 4, 12);
  ctx.fillRect(52, 20, 4, 12);
  ctx.fillStyle = SKIN;
  ctx.fillRect(44, 16, 4, 4);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(48, 16, 4, 4);

  // ── Left Arm (row 32-48, col 32-48) ───────────────────
  ctx.fillStyle = SKIN;
  ctx.fillRect(36, 52, 4, 12);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(32, 52, 4, 12);
  ctx.fillRect(40, 52, 4, 12);
  ctx.fillRect(44, 52, 4, 12);
  ctx.fillStyle = SKIN;
  ctx.fillRect(36, 48, 4, 4);
  ctx.fillStyle = SKIN_SHADOW;
  ctx.fillRect(40, 48, 4, 4);

  // ── Right Leg (row 16-32, col 0-16) ───────────────────
  ctx.fillStyle = PANTS;
  ctx.fillRect(4, 20, 4, 12);
  ctx.fillStyle = PANTS_SHADOW;
  ctx.fillRect(0, 20, 4, 12);
  ctx.fillRect(8, 20, 4, 12);
  ctx.fillRect(12, 20, 4, 12);
  // Shoes (bottom 3px)
  ctx.fillStyle = SHOES;
  ctx.fillRect(4, 29, 4, 3);
  ctx.fillRect(0, 29, 4, 3);
  ctx.fillRect(8, 29, 4, 3);
  ctx.fillRect(12, 29, 4, 3);
  // Top/bottom
  ctx.fillStyle = PANTS;
  ctx.fillRect(4, 16, 4, 4);
  ctx.fillStyle = PANTS_SHADOW;
  ctx.fillRect(8, 16, 4, 4);

  // ── Left Leg (row 32-48, col 16-32) ───────────────────
  ctx.fillStyle = PANTS;
  ctx.fillRect(20, 52, 4, 12);
  ctx.fillStyle = PANTS_SHADOW;
  ctx.fillRect(16, 52, 4, 12);
  ctx.fillRect(24, 52, 4, 12);
  ctx.fillRect(28, 52, 4, 12);
  // Shoes
  ctx.fillStyle = SHOES;
  ctx.fillRect(20, 61, 4, 3);
  ctx.fillRect(16, 61, 4, 3);
  ctx.fillRect(24, 61, 4, 3);
  ctx.fillRect(28, 61, 4, 3);
  // Top/bottom
  ctx.fillStyle = PANTS;
  ctx.fillRect(20, 48, 4, 4);
  ctx.fillStyle = PANTS_SHADOW;
  ctx.fillRect(24, 48, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Create a solid-color material for a body part.
 * We use simple colored materials per part for the blocky Minecraft look.
 */
function makePartMaterial(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/**
 * Create a box mesh with 6 face colors (order: +x, -x, +y, -y, +z, -z).
 * Uses a single geometry with per-face material groups.
 */
function createColoredBox(
  width: number,
  height: number,
  depth: number,
  faceColors: [string, string, string, string, string, string],
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const materials = faceColors.map((c) => makePartMaterial(c));
  const mesh = new THREE.Mesh(geometry, materials);
  return mesh;
}

/**
 * A procedural Minecraft "Steve" character model built from BoxGeometry.
 *
 * Hierarchy:
 *   group (root, positioned at player feet)
 *     ├── body
 *     ├── headPivot → head
 *     ├── leftArmPivot → leftArm
 *     ├── rightArmPivot → rightArm
 *     ├── leftLegPivot → leftLeg
 *     └── rightLegPivot → rightLeg
 */
export class SteveModel {
  readonly group: THREE.Group;

  private readonly headPivot: THREE.Group;
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;
  private readonly body: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly leftArm: THREE.Mesh;
  private readonly rightArm: THREE.Mesh;
  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;

  private readonly materials: THREE.MeshLambertMaterial[] = [];
  private readonly geometries: THREE.BoxGeometry[] = [];

  private walkPhase = 0;
  private talkPhase = 0;

  constructor() {
    this.group = new THREE.Group();

    // ── Head ───────────────────────────────────────────────
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.5, 0); // pivot at neck
    this.head = createColoredBox(
      HEAD_SIZE, HEAD_SIZE, HEAD_SIZE,
      // +x (left side), -x (right side), +y (top), -y (bottom), +z (front), -z (back)
      [SKIN_SHADOW, SKIN_SHADOW, HAIR, SKIN_SHADOW, SKIN, HAIR],
    );
    this.head.position.set(0, HEAD_SIZE / 2, 0); // center head above pivot
    this.collectResources(this.head);
    this.headPivot.add(this.head);
    this.group.add(this.headPivot);

    // ── Body ──────────────────────────────────────────────
    this.body = createColoredBox(
      BODY_W, BODY_H, BODY_D,
      [SHIRT, SHIRT, SHIRT, SHIRT_SHADOW, SHIRT, SHIRT_SHADOW],
    );
    this.body.position.set(0, 0.75 + BODY_H / 2, 0); // body center
    this.collectResources(this.body);
    this.group.add(this.body);

    // ── Right Arm ─────────────────────────────────────────
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(-(BODY_W / 2 + ARM_W / 2), 1.5, 0); // shoulder
    this.rightArm = createColoredBox(
      ARM_W, ARM_H, ARM_D,
      [SKIN, SKIN_SHADOW, SHIRT, SKIN, SKIN, SKIN_SHADOW],
    );
    this.rightArm.position.set(0, -ARM_H / 2, 0);
    this.collectResources(this.rightArm);
    this.rightArmPivot.add(this.rightArm);
    this.group.add(this.rightArmPivot);

    // ── Left Arm ──────────────────────────────────────────
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(BODY_W / 2 + ARM_W / 2, 1.5, 0); // shoulder
    this.leftArm = createColoredBox(
      ARM_W, ARM_H, ARM_D,
      [SKIN_SHADOW, SKIN, SHIRT, SKIN, SKIN, SKIN_SHADOW],
    );
    this.leftArm.position.set(0, -ARM_H / 2, 0);
    this.collectResources(this.leftArm);
    this.leftArmPivot.add(this.leftArm);
    this.group.add(this.leftArmPivot);

    // ── Right Leg ─────────────────────────────────────────
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(-LEG_W / 2, 0.75, 0); // hip
    this.rightLeg = createColoredBox(
      LEG_W, LEG_H, LEG_D,
      [PANTS_SHADOW, PANTS, PANTS, SHOES, PANTS, PANTS_SHADOW],
    );
    this.rightLeg.position.set(0, -LEG_H / 2, 0);
    this.collectResources(this.rightLeg);
    this.rightLegPivot.add(this.rightLeg);
    this.group.add(this.rightLegPivot);

    // ── Left Leg ──────────────────────────────────────────
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(LEG_W / 2, 0.75, 0); // hip
    this.leftLeg = createColoredBox(
      LEG_W, LEG_H, LEG_D,
      [PANTS, PANTS_SHADOW, PANTS, SHOES, PANTS, PANTS_SHADOW],
    );
    this.leftLeg.position.set(0, -LEG_H / 2, 0);
    this.collectResources(this.leftLeg);
    this.leftLegPivot.add(this.leftLeg);
    this.group.add(this.leftLegPivot);

    // Add shadow plane under feet
    this.group.castShadow = true;
  }

  private collectResources(mesh: THREE.Mesh): void {
    const geo = mesh.geometry;
    if (geo instanceof THREE.BoxGeometry) {
      this.geometries.push(geo);
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshLambertMaterial) {
        this.materials.push(m);
      }
    }
  }

  /** Set character world position (feet position). */
  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /** Set character body yaw (horizontal rotation). */
  setRotation(yaw: number): void {
    this.group.rotation.y = yaw;
  }

  /** Set head pitch (looking up/down). */
  setHeadPitch(pitch: number): void {
    this.headPivot.rotation.x = pitch;
  }

  /**
   * Update walk and talk animations.
   * @param dt - delta time in seconds
   * @param velocity - [vx, vy, vz] player velocity
   * @param isTalking - whether the player is currently talking
   */
  updateAnimation(
    dt: number,
    velocity: [number, number, number],
    isTalking: boolean,
  ): void {
    const [vx, , vz] = velocity;
    const horizontalSpeed = Math.sqrt(vx * vx + vz * vz);
    const isWalking = horizontalSpeed > 0.5;

    // ── Walk animation ────────────────────────────────────
    if (isWalking) {
      this.walkPhase += dt * WALK_SWING_SPEED * (horizontalSpeed / 6.8);
      const swing = Math.sin(this.walkPhase) * WALK_SWING_AMPLITUDE;

      // Arms swing opposite to legs
      this.rightArmPivot.rotation.x = swing;
      this.leftArmPivot.rotation.x = -swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftLegPivot.rotation.x = swing;
    } else {
      // Smoothly return to idle
      this.walkPhase = 0;
      const decay = 1 - Math.min(1, dt * 10);
      this.rightArmPivot.rotation.x *= decay;
      this.leftArmPivot.rotation.x *= decay;
      this.rightLegPivot.rotation.x *= decay;
      this.leftLegPivot.rotation.x *= decay;
    }

    // ── Talk animation (gentle head nod) ──────────────────
    if (isTalking) {
      this.talkPhase += dt * TALK_NOD_SPEED;
      this.headPivot.rotation.x = Math.sin(this.talkPhase) * TALK_NOD_AMPLITUDE;
    } else {
      this.talkPhase = 0;
      // Don't reset head pitch — it's set externally via setHeadPitch
    }
  }

  /** Clean up all GPU resources. */
  dispose(): void {
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
  }
}
