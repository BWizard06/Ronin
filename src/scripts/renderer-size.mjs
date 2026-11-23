/** Queue layout changes without clearing the WebGL canvas between frames. */
export function createRendererSize(renderer) {
  let pending = null;
  let applied = null;
  const same = (a, b) => a && b && a.width === b.width && a.height === b.height && a.pixelRatio === b.pixelRatio;

  return {
    request(width, height, pixelRatio) {
      if (![width, height, pixelRatio].every(Number.isFinite) || width < 1 || height < 1 || pixelRatio <= 0) return false;
      const next = { width: Math.round(width), height: Math.round(height), pixelRatio };
      if (same(next, pending ?? applied)) return false;
      pending = next;
      return true;
    },
    /** Call at the start of rendering, then draw in that same animation frame. */
    apply() {
      if (!pending) return applied;
      const next = pending;
      pending = null;
      if (same(next, applied)) return applied;
      if (renderer.getPixelRatio() !== next.pixelRatio) renderer.setPixelRatio(next.pixelRatio);
      renderer.setSize(next.width, next.height, false);
      applied = next;
      return applied;
    },
  };
}
