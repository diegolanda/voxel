import type { InputState } from "../types";

const MOVEMENT_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Space", "ShiftLeft", "ShiftRight",
]);

export class DesktopInput {
  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private locked = false;
  private selectedSlot = 0;
  private onSlotChange?: (slot: number) => void;
  private onLeftClick?: () => void;
  private onRightClick?: () => void;

  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handlePointerLockChange: () => void;
  private handleMouseDown: (e: MouseEvent) => void;
  private handleContextMenu: (e: Event) => void;
  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks?: {
      onSlotChange?: (slot: number) => void;
      onLeftClick?: () => void;
      onRightClick?: () => void;
    },
  ) {
    this.canvas = canvas;
    this.onSlotChange = callbacks?.onSlotChange;
    this.onLeftClick = callbacks?.onLeftClick;
    this.onRightClick = callbacks?.onRightClick;

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      // Number keys 1-9 for hotbar
      if (e.code >= "Digit1" && e.code <= "Digit9") {
        this.selectedSlot = parseInt(e.code.replace("Digit", "")) - 1;
        this.onSlotChange?.(this.selectedSlot);
      }
    };

    this.handleKeyUp = (e: KeyboardEvent) => {
      if (MOVEMENT_KEYS.has(e.code)) {
        e.preventDefault();
      }
      this.keys.delete(e.code);
    };

    this.handleMouseMove = (e: MouseEvent) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    };

    this.handlePointerLockChange = () => {
      this.locked = document.pointerLockElement === canvas;
    };

    this.handleMouseDown = (e: MouseEvent) => {
      if (!this.locked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.onLeftClick?.();
      if (e.button === 2) this.onRightClick?.();
    };

    this.handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  getState(): InputState {
    return {
      forward: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      backward: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      jump: this.keys.has("Space"),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      pointerLocked: this.locked,
      mouseDeltaX: this.mouseDX,
      mouseDeltaY: this.mouseDY,
      touchJoystickX: 0,
      touchJoystickY: 0,
      touchLookDeltaX: 0,
      touchLookDeltaY: 0,
    };
  }

  clearDeltas(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  dispose(): void {
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }
}
