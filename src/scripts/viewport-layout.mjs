/** Match the portrait content layout, including small tablets. */
export const portraitLayout = (width, height) => width < 700 || (width < 1000 && height >= width);

/** Follow the real preview slot while its reading section scrolls normally. */
export function inspectionArea(top, bottom, height) {
  const inset = Math.min(26, (bottom - top) * .08);
  return { left: .08, right: .92, top: (top + 90) / height, bottom: Math.max(top + 170, bottom - inset) / height };
}

/** Allocate space from measured copy, rather than assuming every phone is tall. */
export function culturalArea(height, copyHeight, controlsHeight, safeTop = 0, safeBottom = 0) {
  const copyTop = Math.max(height * .48, height - copyHeight - Math.max(24, safeBottom + 12));
  const controlsTop = copyTop - controlsHeight - 14;
  return {
    copyTop, controlsTop,
    area: { left: .06, right: .94, top: Math.max(72, safeTop + 58) / height, bottom: Math.max(190, controlsTop - 14) / height },
  };
}

/** Bound fill rate on touch devices, also when the phone is turned sideways. */
export function renderPixelRatio(width, height, deviceRatio, coarse) {
  const cap = coarse ? 1.5 : 1.75;
  const budget = coarse ? 1800000 : 3600000;
  return Math.min(deviceRatio || 1, cap, Math.max(1, Math.sqrt(budget / Math.max(1, width * height))));
}
