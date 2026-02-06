import { createNoise2D, createNoise3D } from "simplex-noise";

/**
 * Alea PRNG — deterministic seeded random number generator.
 * Produces a () => number function that returns values in [0, 1).
 */
export function alea(seed: string): () => number {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;

  const mash = createMash();
  s0 = mash(" ");
  s1 = mash(" ");
  s2 = mash(" ");
  s0 -= mash(seed);
  if (s0 < 0) s0 += 1;
  s1 -= mash(seed);
  if (s1 < 0) s1 += 1;
  s2 -= mash(seed);
  if (s2 < 0) s2 += 1;

  return () => {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10;
    s0 = s1;
    s1 = s2;
    c = t | 0;
    s2 = t - c;
    return s2;
  };
}

function createMash(): (data: string) => number {
  let n = 0xefc8249d;
  return (data: string) => {
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  };
}

export interface NoiseGenerator {
  noise2D: (x: number, y: number) => number;
  noise3D: (x: number, y: number, z: number) => number;
}

export function createSeededNoise(seed: string): NoiseGenerator {
  const rng = alea(seed);
  return {
    noise2D: createNoise2D(rng),
    noise3D: createNoise3D(rng),
  };
}
