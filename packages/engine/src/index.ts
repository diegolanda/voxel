export interface EngineRuntimeContract {
  mount(canvas: HTMLCanvasElement): void;
  dispose(): void;
}
