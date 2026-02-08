import * as THREE from "three";
import type { SkyConfig } from "@voxel/worldgen";

const SKY_RADIUS = 490;

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunAngularRadius;
uniform float uSunGlowIntensity;

varying vec3 vWorldPosition;

void main() {
  vec3 dir = normalize(vWorldPosition);

  // Elevation: 0 at horizon, 1 at zenith
  float elevation = max(dir.y, 0.0);

  // Stylized gradient — wide horizon band that narrows toward zenith
  float gradientFactor = pow(elevation, 0.6);
  vec3 skyColor = mix(uHorizonColor, uZenithColor, gradientFactor);

  // Sun disc with slight feather for stylized look
  float sunAngle = acos(clamp(dot(dir, uSunDirection), -1.0, 1.0));
  float sunDisc = 1.0 - smoothstep(
    uSunAngularRadius * 0.85,
    uSunAngularRadius,
    sunAngle
  );

  // Soft glow halo
  float sunGlow = exp(-sunAngle * sunAngle / (0.1 * 0.1)) * uSunGlowIntensity;

  vec3 finalColor = skyColor + uSunColor * sunDisc + uSunColor * sunGlow * 0.3;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function computeSunDirection(elevation: number, azimuth: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();
}

export class SkyDome {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.SphereGeometry;

  constructor(config: SkyConfig) {
    this.geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);

    const sunDir = computeSunDirection(config.sunElevation, config.sunAzimuth);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uZenithColor: { value: new THREE.Color(config.zenithColor) },
        uHorizonColor: { value: new THREE.Color(config.horizonColor) },
        uSunColor: { value: new THREE.Color(config.sunColor) },
        uSunDirection: { value: sunDir },
        uSunAngularRadius: { value: config.sunAngularRadius },
        uSunGlowIntensity: { value: config.sunGlowIntensity },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
  }

  update(cameraPosition: THREE.Vector3): void {
    this.mesh.position.copy(cameraPosition);
  }

  getSunDirection(): THREE.Vector3 {
    return (this.material.uniforms.uSunDirection.value as THREE.Vector3).clone();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
