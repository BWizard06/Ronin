import { clamp, smooth } from './motion.mjs';

const passage = (p, start, enter, leave, end) => smooth(start, enter, p) * (1 - smooth(leave, end, p));

export function detailState(progress) {
  const p = clamp(progress);
  return {
    archive: passage(p, .17, .24, .30, .38),
    steel: passage(p, .285, .37, .47, .55),
    weave: passage(p, .46, .55, .61, .69),
    assembly: passage(p, .62, .70, .83, .93),
  };
}

export function hasDetailMotion(progress, reduced) {
  return !reduced && Object.values(detailState(progress)).some(value => value > .001);
}
