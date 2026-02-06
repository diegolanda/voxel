import type { InputState } from "../types";

export class MobileInput {
  private joystickX = 0;
  private joystickY = 0;
  private lookDX = 0;
  private lookDY = 0;
  private jumping = false;
  private onLeftClick?: () => void;
  private onRightClick?: () => void;

  private joystickTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private joystickStart = { x: 0, y: 0 };
  private lookStart = { x: 0, y: 0 };
  private lastTapTime = 0;

  private handleTouchStart: (e: TouchEvent) => void;
  private handleTouchMove: (e: TouchEvent) => void;
  private handleTouchEnd: (e: TouchEvent) => void;
  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks?: {
      onLeftClick?: () => void;
      onRightClick?: () => void;
    },
  ) {
    this.canvas = canvas;
    this.onLeftClick = callbacks?.onLeftClick;
    this.onRightClick = callbacks?.onRightClick;

    const halfWidth = () => canvas.clientWidth / 2;

    this.handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < halfWidth()) {
          // Left side: joystick
          this.joystickTouchId = touch.identifier;
          this.joystickStart = { x: touch.clientX, y: touch.clientY };
        } else {
          // Right side: look + double-tap jump
          const now = Date.now();
          if (now - this.lastTapTime < 300) {
            this.jumping = true;
            setTimeout(() => { this.jumping = false; }, 200);
          }
          this.lastTapTime = now;
          this.lookTouchId = touch.identifier;
          this.lookStart = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    this.handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          const dx = touch.clientX - this.joystickStart.x;
          const dy = touch.clientY - this.joystickStart.y;
          const maxDist = 60;
          this.joystickX = Math.max(-1, Math.min(1, dx / maxDist));
          this.joystickY = Math.max(-1, Math.min(1, -dy / maxDist)); // Invert Y
        }
        if (touch.identifier === this.lookTouchId) {
          this.lookDX += touch.clientX - this.lookStart.x;
          this.lookDY += touch.clientY - this.lookStart.y;
          this.lookStart = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    this.handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickX = 0;
          this.joystickY = 0;
        }
        if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    };

    canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.handleTouchEnd);
    canvas.addEventListener("touchcancel", this.handleTouchEnd);
  }

  /** Called from HUD button */
  triggerBreak(): void {
    this.onLeftClick?.();
  }

  /** Called from HUD button */
  triggerPlace(): void {
    this.onRightClick?.();
  }

  /** Called from HUD button */
  triggerJump(): void {
    this.jumping = true;
    setTimeout(() => { this.jumping = false; }, 200);
  }

  getState(): InputState {
    return {
      forward: this.joystickY > 0.2,
      backward: this.joystickY < -0.2,
      left: this.joystickX < -0.2,
      right: this.joystickX > 0.2,
      jump: this.jumping,
      sprint: false,
      pointerLocked: false,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      touchJoystickX: this.joystickX,
      touchJoystickY: this.joystickY,
      touchLookDeltaX: this.lookDX,
      touchLookDeltaY: this.lookDY,
    };
  }

  clearDeltas(): void {
    this.lookDX = 0;
    this.lookDY = 0;
  }

  dispose(): void {
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.handleTouchEnd);
  }
}
