import { clamp, mix } from './motion.mjs';

const focuses = [
  { zoom: 0, x: 2.2, y: 0, height: 5.5, z: -.63, turn: -.32, mobileHeight: 7.6 },
  { zoom: 1, x: 3.7, y: .13, height: 5.1, z: -.35, turn: -.16, mobileHeight: 7.6 },
  { zoom: 1, x: -1.2, y: 0, height: 4.2, z: -.7, turn: -.42, mobileHeight: 7.6 },
  { zoom: 1, x: 0, y: 0, height: 2.2, z: -.4, turn: -1.18, mobileHeight: 4.1 },
  { zoom: 0, x: 2.7, y: -.8, height: 5.5, z: -.63, turn: -.32, mobileHeight: 7.6 },
];

/** Blend content framing into the existing object choreography, never teleport. */
export function inspectionFrame(frame, presence, topic, mobile = false, area) {
  const t = clamp(topic, 0, focuses.length - 1), a = focuses[Math.floor(t)], b = focuses[Math.ceil(t)];
  const focus = key => mix(a[key], b[key], t % 1);
  const target = {
    rotationX: .16, rotationY: focus('turn'), rotationZ: mobile ? -.25 : focus('z'),
    zoom: focus('zoom'), focusX: focus('x'), focusY: focus('y'),
    detailHeight: mobile ? focus('mobileHeight') : focus('height'),
    screenX: mobile ? .5 : .35, screenY: mobile ? .28 : .48,
    safeLeft: mobile ? .07 : .045, safeRight: mobile ? .93 : .63,
    safeTop: mobile ? .13 : .21, safeBottom: mobile ? .43 : .78,
    paired: 1, sayaX: 0, sayaY: -.87, sayaAngle: 0, separation: 0, free: 0,
  };
  if (mobile && area) {
    target.safeLeft=area.left; target.safeRight=area.right;
    target.safeTop=area.top; target.safeBottom=area.bottom;
    target.screenX=(area.left+area.right)/2; target.screenY=(area.top+area.bottom)/2;
    target.detailHeight *= .30 / Math.max(.12, area.bottom-area.top);
  }
  const result = { ...frame };
  for (const key of Object.keys(target)) result[key] = mix(frame[key], target[key], clamp(presence));
  return result;
}

/** Interpolate camera properties directly; never travel through topic indices. */
export function createInspectionMotion() {
  let pose;
  return (frame, presence, topic, mobile, dt, reduced = false, area) => {
    const desired = inspectionFrame(frame, 1, topic, mobile, area);
    if (!pose || presence < .001 || reduced) pose = { ...desired };
    const ease = reduced ? 1 : 1 - Math.exp(-Math.min(dt,.05) * 10);
    for (const key of Object.keys(desired)) if (typeof desired[key] === 'number') pose[key] = mix(pose[key],desired[key],ease);
    // Scrolling the DOM slot must not leave the sword lagging over the text.
    if(mobile && area)for(const key of ['safeTop','safeBottom','screenY'])pose[key]=desired[key];
    const result = { ...frame };
    for (const key of ['rotationX','rotationY','rotationZ','zoom','focusX','focusY','detailHeight','screenX','screenY','safeLeft','safeRight','safeTop','safeBottom','paired','sayaX','sayaY','sayaAngle','separation','free']) result[key] = mix(frame[key],pose[key],clamp(presence));
    return result;
  };
}
