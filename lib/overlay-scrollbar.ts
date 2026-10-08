export function getScrollbarMetrics(viewport: number, content: number, offset: number) {
  const maxScroll = Math.max(0, content - viewport);
  const trackSize = Math.max(0, viewport - 4);
  if (maxScroll <= 1 || trackSize === 0) return null;

  const thumbSize = Math.min(trackSize, Math.max(24, trackSize * viewport / content));
  const travel = trackSize - thumbSize;
  const thumbOffset = Math.max(0, Math.min(maxScroll, offset)) / maxScroll * travel;
  return { maxScroll, thumbSize, thumbOffset, travel };
}
