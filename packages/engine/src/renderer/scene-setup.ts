import * as THREE from "three";
import type { BiomeConfig } from "@voxel/worldgen";
import { createTextureAtlas } from "./texture-atlas";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  blockMaterial: THREE.MeshLambertMaterial;
  chunkGroup: THREE.Group;
  dispose: () => void;
}

export function setupScene(
  canvas: HTMLCanvasElement,
  themeConfig: BiomeConfig,
  pixelRatioCap: number,
): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(themeConfig.skyColor);
  scene.fog = new THREE.Fog(
    themeConfig.fogColor,
    themeConfig.fogNear,
    themeConfig.fogFar,
  );

  const aspect = canvas.clientWidth / canvas.clientHeight || 1;
  const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
  camera.position.set(8, 40, 8);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, themeConfig.ambientIntensity);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, themeConfig.sunIntensity);
  directional.position.set(50, 100, 30);
  scene.add(directional);

  // Block material with atlas texture
  const atlas = createTextureAtlas();
  const blockMaterial = new THREE.MeshLambertMaterial({
    map: atlas,
  });

  const chunkGroup = new THREE.Group();
  scene.add(chunkGroup);

  // Resize handling
  const resizeObserver = new ResizeObserver(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  resizeObserver.observe(canvas);

  const dispose = () => {
    resizeObserver.disconnect();
    atlas.dispose();
    blockMaterial.dispose();
    renderer.dispose();
  };

  return { scene, camera, renderer, blockMaterial, chunkGroup, dispose };
}
