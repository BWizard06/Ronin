export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
export const mix = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, value) {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
const envelope = (p, start, inEnd, outStart, end) => smooth(start, inEnd, p) * (1 - smooth(outStart, end, p));

// Camera poses are authored around the object. Type follows its projection;
// there are no alternating left/right text slots in the camera choreography.
const poses = [
  { p: 0,    rx: .12, ry: -.18, rz: .28, mz: 1.04, zoom: 0, fx: 2.2, fy: 0, dh: 3.6 },
  { p: .12,  rx: .42, ry: -.40, rz: -.10, mz: .95, zoom: 0, fx: 2.2, fy: 0, dh: 3.6 },
  { p: .26,  rx: .20, ry: .10, rz: -.12, mz: 1.12, zoom: 0, fx: 2.8, fy: .1, dh: 3.8 },
  { p: .42,  rx: 3.02, ry: .15, rz: .98, mz: 1.1, zoom: 1, fx: 3.7, fy: .12, dh: 4.1 },
  { p: .58,  rx: 6.42, ry: -.72, rz: -.52, mz: .85, zoom: 1, fx: -1.10, fy: 0, dh: 2.7 },
  { p: .74,  rx: 6.62, ry: -.20, rz: .13, mz: 1.04, zoom: 0, fx: 2.2, fy: 0, dh: 3.2 },
  { p: .84,  rx: 6.85, ry: .28, rz: -.16, mz: .92, zoom: 0, fx: 2.2, fy: 0, dh: 3.2 },
  { p: 1,    rx: 6.4, ry: -.18, rz: .20, mz: 1.04, zoom: 0, fx: 2.2, fy: 0, dh: 3.2 },
];
export const REST_POSES = [0, .24, .325, .407, .478, .57, .75, .835, 1];

export function sampleMotion(progress, mobile = false) {
  const p = clamp(progress);
  const nextIndex = poses.findIndex(pose => pose.p >= p);
  const next = poses[Math.max(1, nextIndex)];
  const previous = poses[Math.max(0, nextIndex - 1)];
  const t = smooth(previous.p, next.p, p);
  const get = key => mix(previous[key], next[key], t);
  const draw = smooth(.07, .26, p);
  const paired = smooth(.60, .74, p);
  const distance = 7.5 * draw;
  return {
    progress: p,
    rotationX: get('rx'), rotationY: get('ry'), rotationZ: get(mobile ? 'mz' : 'rz'),
    zoom: get('zoom'), focusX: get('fx'), focusY: get('fy'),
    detailHeight: mobile ? Math.max(3.9, get('dh') * 1.25) : get('dh'),
    screenX: .5, screenY: .5,
    safeLeft: mobile ? .08 : .07, safeRight: mobile ? .92 : .93,
    safeTop: mobile ? .14 : mix(.18, .12, smooth(.08, .24, p)), safeBottom: mobile ? .86 : .88,
    draw, paired, sayaX: mix(distance, 0, paired), sayaY: mix(.008 * distance * distance, -.87, paired), sayaAngle: mix(Math.atan(.016 * distance), 0, paired),
    separation: smooth(.63, .72, p) * (1 - smooth(.81, .92, p)),
    dark: envelope(p, .30, .38, .59, .66),
    red: envelope(p, .64, .71, .82, .91),
    // A travelling key light reveals both faces during the full axial turn.
    lightAngle: -0.7 + smooth(.27, .46, p) * 2.7 - smooth(.49, .62, p) * 1.8,
    free: smooth(.92, .98, p),
  };
}

export function reducedProgress(value) {
  const p = clamp(value);
  return p < .16 ? 0 : p < .295 ? .24 : p < .36 ? .325 : p < .45 ? .407 : p < .51 ? .478 : p < .66 ? .57 : p < .80 ? .75 : p < .90 ? .835 : 1;
}

export function scrollProgress(top, containerHeight, viewportHeight) {
  return clamp(-top / Math.max(1, containerHeight - viewportHeight));
}
