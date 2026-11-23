/** Weighted completed work, never elapsed time. The last task is a rendered frame. */
export function createLoadProgress(onChange) {
  const weights = { engine: 8, fonts: 5, katana: 38, saya: 8, torii: 12, sakura: 24, scene: 5 };
  const fractions = Object.fromEntries(Object.keys(weights).map(key => [key, 0]));
  return (key, fraction) => {
    if (!(key in weights) || !Number.isFinite(fraction)) return;
    fractions[key] = Math.max(fractions[key], Math.min(1, Math.max(0, fraction)));
    const value = Object.entries(weights).reduce((sum, [name, weight]) => sum + weight * fractions[name], 0);
    onChange(value);
  };
}
