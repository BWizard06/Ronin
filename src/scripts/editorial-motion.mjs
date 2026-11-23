import { clamp, smooth } from './motion.mjs';

export const EDITORIAL_MOMENTS = [
  { id: 'opening', enter: 0, full: 0, leave: .065, exit: .10 },
  { id: 'craft', enter: .17, full: .215, leave: .265, exit: .295 },
  { id: 'glass', enter: .36, full: .385, leave: .428, exit: .45 },
  { id: 'hand', enter: .515, full: .545, leave: .595, exit: .62 },
  { id: 'assembly', enter: .685, full: .72, leave: .775, exit: .80 },
  { id: 'return', enter: .91, full: .955, leave: 1, exit: 1 },
];

export function editorialState(progress) {
  const p = clamp(progress);
  /** @type {Record<string, number>} */
  const opacity = {};
  for (const moment of EDITORIAL_MOMENTS) {
    const enter = moment.enter === moment.full ? 1 : smooth(moment.enter, moment.full, p);
    const leave = moment.leave === moment.exit ? 1 : 1 - smooth(moment.leave, moment.exit, p);
    opacity[moment.id] = enter * leave;
  }
  const active = Object.keys(opacity).reduce((best, key) => opacity[key] > opacity[best] ? key : best, 'opening');
  return { opacity, active: opacity[active] > .01 ? active : null };
}
