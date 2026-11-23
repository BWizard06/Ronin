import { clamp, smooth } from './motion.mjs';

export function openingState(progress) {
  const p = clamp(progress);
  const returning = smooth(.84, .94, p);
  return {
    landscape: Math.max(1 - smooth(.125, .205, p), returning),
    lift: smooth(.015, .125, p) * (1 - returning * .85),
    paper: smooth(.085, .135, p) * (1 - smooth(.225, .26, p)),
    opening: smooth(.135, .255, p),
  };
}

export function hasAmbientMotion(progress, reduced) {
  return !reduced && openingState(progress).landscape > .001;
}
