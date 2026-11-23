import { clamp, smooth } from './motion.mjs';

export function toggleTopic(current, requested) {
  const next=Math.round(clamp(requested,0,4));
  return current===next ? 0 : next;
}

// Detail controls belong only to inspection, never to the exploded passage.
export function inspectionControls(presence, ready) {
  const opacity=ready ? smooth(.88,1,presence) : 0;
  return {opacity,enabled:opacity>=.9};
}
