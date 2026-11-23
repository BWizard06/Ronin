import { clamp, mix, smooth } from './motion.mjs';

/** @typedef {{start:number,end:number,from:number,to:number,mode:string}} Span */

/** Physical reading space holds a pose; it never consumes the next animation. @param {Span[]} spans */
export function sampleJourney(spans, scroll, viewport) {
  const y = Math.max(0, scroll);
  const span = spans.find(item => y < item.end) ?? spans.at(-1);
  const progress = span ? mix(span.from, span.to, clamp((y - span.start) / Math.max(1, span.end - span.start))) : 0;
  let mode = '', presence = 0, contentProgress = 0;
  for (const item of spans) {
    if (!item.mode) continue;
    const weight = smooth(item.start - viewport * .65, item.start, y) * (1 - smooth(item.end - viewport * .22, item.end + viewport * .38, y));
    if (weight > presence) { mode = item.mode; presence = weight; contentProgress = clamp((y - item.start) / Math.max(viewport*.25,item.end-item.start-viewport)); }
  }
  return { progress: clamp(progress), mode, presence, contentProgress };
}

/** @param {Span[]} spans */
export function journeyOffset(spans, progress) {
  const p = clamp(progress);
  const span = spans.find(item => !item.mode && item.to > item.from && p >= item.from && p <= item.to);
  if (!span) return p === 0 ? 0 : (spans.at(-1)?.end ?? 0);
  return mix(span.start, span.end, (p - span.from) / (span.to - span.from));
}

export function timelineIndex(value, count = 5) { return Math.round(clamp(Number(value), 0, 1000) / 1000 * Math.max(0, count - 1)); }
