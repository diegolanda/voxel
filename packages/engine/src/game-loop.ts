export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: () => void;
  onFps?: (fps: number) => void;
}

export class GameLoop {
  private running = false;
  private animFrameId = 0;
  private lastTime = 0;
  private fpsFrames = 0;
  private fpsLastTime = 0;
  private callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsLastTime = this.lastTime;
    this.fpsFrames = 0;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Cap delta to prevent spiral of death
    if (dt > 0.1) dt = 0.1;

    this.callbacks.update(dt);
    this.callbacks.render();

    // FPS tracking
    this.fpsFrames++;
    if (now - this.fpsLastTime >= 1000) {
      this.callbacks.onFps?.(this.fpsFrames);
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }
  };
}
