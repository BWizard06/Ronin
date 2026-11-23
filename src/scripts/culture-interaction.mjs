import { clamp, smooth } from './motion.mjs';

/** Only the settled compositions accept gestures. The passage itself belongs
 * to scrolling, including when returning from the tree to the gate. */
export function cultureTarget(presence, progress) {
  if(presence<.94)return '';
  if(progress<=.16)return 'torii';
  if(progress>=.82)return 'sakura';
  return '';
}

export function cultureTurnWeight(progress, target) {
  return target==='torii' ? 1-smooth(.16,.32,progress) : smooth(.64,.82,progress);
}

export function gestureIntent(dx,dy,touch=false) {
  if(Math.hypot(dx,dy)<6)return 'pending';
  return touch && Math.abs(dy)>Math.abs(dx) ? 'scroll' : 'rotate';
}

export function turnCulture(value, delta, width) {
  return clamp(value+delta/Math.max(240,width)*Math.PI*2,-Math.PI,Math.PI);
}

/** A single finite gust, without an infinite velocity accumulator. */
export function blossomGust(age) {
  if(age<0||age>=4.8)return 0;
  return smooth(0,.2,age)*(1-smooth(.65,4.8,age));
}
