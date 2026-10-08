'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getScrollbarMetrics } from '@/lib/overlay-scrollbar';

type Axis = 'vertical' | 'horizontal';
interface Thumb {
  id: string;
  target: HTMLElement;
  axis: Axis;
  quiet: boolean;
  visible: boolean;
  top: number;
  left: number;
  size: number;
  offset: number;
  maxScroll: number;
  travel: number;
  viewport: number;
  clip: string;
  zIndex: number;
}

// Portals keep thumbs out of the scroll layout and above clipped calendar content.
export function OverlayScrollbars() {
  const [mounted, setMounted] = useState(false);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const activity = useRef(new Map<HTMLElement, number>());
  const dragging = useRef<{ thumb: Thumb; coordinate: number; offset: number } | null>(null);
  const refresh = useRef<() => void>(() => {});
  const wake = useRef<(target: HTMLElement) => void>(() => {});

  useEffect(() => {
    setMounted(true);
    let frame = 0;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let targets: HTMLElement[] = [];
    let nextId = 0;
    const ids = new WeakMap<HTMLElement, number>();
    const page = document.scrollingElement as HTMLElement;
    const resize = new ResizeObserver(() => schedule());

    const measure = () => {
      frame = 0;
      const next: Thumb[] = [];
      const now = Date.now();
      for (const [target, until] of activity.current) {
        if (!target.isConnected || until <= now) activity.current.delete(target);
      }
      for (const target of targets) {
        const isPage = target === page;
        const bounds = isPage
          ? { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
          : target.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= window.innerHeight || bounds.right <= 0 || bounds.left >= window.innerWidth) continue;
        if (!isPage && !target.getClientRects().length) continue;
        let top = Math.max(0, bounds.top);
        let bottom = Math.min(window.innerHeight, bounds.bottom);
        let left = Math.max(0, bounds.left);
        let right = Math.min(window.innerWidth, bounds.right);
        let zIndex = Math.max(50, Number.parseInt(getComputedStyle(target).zIndex, 10) + 1 || 0);
        // A portalled thumb must respect the same clipping ancestors as its viewport.
        for (let parent = isPage ? null : target.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          zIndex = Math.max(zIndex, Number.parseInt(style.zIndex, 10) + 1 || 0);
          const rect = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            top = Math.max(top, rect.top);
            bottom = Math.min(bottom, rect.bottom);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            left = Math.max(left, rect.left);
            right = Math.min(right, rect.right);
          }
        }
        if (bottom <= top || right <= left) continue;
        if (!ids.has(target)) ids.set(target, nextId++);
        if (!target.id) target.id = `overlay-scroll-target-${ids.get(target)}`;
        const quiet = target.classList.contains('quiet-scroll');
        const visible = !quiet || (activity.current.get(target) ?? 0) > now || dragging.current?.thumb.target === target;
        for (const axis of ['vertical', 'horizontal'] as const) {
          const vertical = axis === 'vertical';
          const viewport = isPage ? (vertical ? window.innerHeight : window.innerWidth) : (vertical ? target.clientHeight : target.clientWidth);
          const offset = vertical ? target.scrollTop : target.scrollLeft;
          const metrics = getScrollbarMetrics(viewport, vertical ? target.scrollHeight : target.scrollWidth, offset);
          if (!metrics) continue;
          const originTop = bounds.top + (isPage ? 0 : target.clientTop);
          const originLeft = bounds.left + (isPage ? 0 : target.clientLeft);
          const thumbTop = vertical ? originTop + 2 + metrics.thumbOffset : originTop + (isPage ? window.innerHeight : target.clientHeight) - 8;
          const thumbLeft = vertical ? originLeft + target.clientWidth - 8 : originLeft + 2 + metrics.thumbOffset;
          next.push({
            id: `${ids.get(target)}-${axis}`, target, axis, quiet, visible,
            top: thumbTop,
            left: isPage && vertical ? window.innerWidth - 8 : thumbLeft,
            size: metrics.thumbSize, offset, viewport, zIndex, ...metrics,
            clip: `inset(${Math.max(0, top - thumbTop)}px ${Math.max(0, thumbLeft + (vertical ? 6 : metrics.thumbSize) - right)}px ${Math.max(0, thumbTop + (vertical ? metrics.thumbSize : 6) - bottom)}px ${Math.max(0, left - thumbLeft)}px)`,
          });
        }
      }
      setThumbs(next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const activate = (target: HTMLElement) => {
      activity.current.set(target, Date.now() + 800);
      if (expiry) clearTimeout(expiry);
      expiry = setTimeout(schedule, 850);
      schedule();
    };
    const discover = () => {
      targets = [page, ...Array.from(document.querySelectorAll<HTMLElement>('.quiet-scroll, [data-page-scroll]'))].filter((target, index, all) => all.indexOf(target) === index);
      resize.disconnect();
      for (const target of targets) {
        resize.observe(target);
        // Content resizing must update the thumb even when its viewport stays fixed.
        for (const child of target.children) if (!child.hasAttribute('data-overlay-scrollbars')) resize.observe(child);
      }
      schedule();
    };
    const mutations = new MutationObserver((records) => {
      if (records.some(record => !(record.target instanceof Element) || !record.target.closest('[data-overlay-scrollbars]'))) discover();
    });
    const onScroll = (event: Event) => {
      if (event.target instanceof HTMLElement && targets.includes(event.target)) activate(event.target);
      else schedule();
    };
    refresh.current = schedule;
    wake.current = activate;
    discover();
    mutations.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      if (expiry) clearTimeout(expiry);
      resize.disconnect();
      mutations.disconnect();
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', schedule);
      refresh.current = () => {};
      wake.current = () => {};
    };
  }, []);

  const setOffset = (thumb: Thumb, value: number) => {
    const offset = Math.max(0, Math.min(thumb.maxScroll, value));
    if (thumb.axis === 'vertical') thumb.target.scrollTop = offset;
    else thumb.target.scrollLeft = offset;
    wake.current(thumb.target);
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>, thumb: Thumb) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { thumb, coordinate: thumb.axis === 'vertical' ? event.clientY : event.clientX, offset: thumb.offset };
    wake.current(thumb.target);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragging.current;
    if (!drag || drag.thumb.travel === 0) return;
    const coordinate = drag.thumb.axis === 'vertical' ? event.clientY : event.clientX;
    setOffset(drag.thumb, drag.offset + (coordinate - drag.coordinate) / drag.thumb.travel * drag.thumb.maxScroll);
  };
  const endDrag = () => {
    const target = dragging.current?.thumb.target;
    dragging.current = null;
    if (target) wake.current(target);
    refresh.current();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, thumb: Thumb) => {
    const changes: Record<string, number> = { ArrowDown: 40, ArrowRight: 40, ArrowUp: -40, ArrowLeft: -40, PageDown: thumb.viewport * .9, PageUp: -thumb.viewport * .9 };
    if (event.key === 'Home' || event.key === 'End' || event.key in changes) {
      event.preventDefault();
      setOffset(thumb, event.key === 'Home' ? 0 : event.key === 'End' ? thumb.maxScroll : thumb.offset + changes[event.key]);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div data-overlay-scrollbars>
      {thumbs.map(thumb => (
        <div
          key={thumb.id}
          className={`overlay-scrollbar-thumb ${thumb.quiet ? 'overlay-scrollbar-quiet' : ''}`}
          role="scrollbar"
          aria-label={thumb.axis === 'vertical' ? 'Scroll vertically' : 'Scroll horizontally'}
          aria-orientation={thumb.axis}
          aria-controls={thumb.target.id}
          aria-valuemin={0}
          aria-valuemax={Math.round(thumb.maxScroll)}
          aria-valuenow={Math.round(thumb.offset)}
          tabIndex={0}
          style={{ top: thumb.top, left: thumb.left, width: thumb.axis === 'vertical' ? 6 : thumb.size, height: thumb.axis === 'vertical' ? thumb.size : 6, opacity: thumb.visible ? (thumb.quiet ? .1 : 1) : 0, clipPath: thumb.clip, pointerEvents: thumb.visible ? 'auto' : 'none', zIndex: thumb.zIndex }}
          onFocus={() => wake.current(thumb.target)}
          onPointerDown={event => startDrag(event, thumb)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={event => onKeyDown(event, thumb)}
        />
      ))}
    </div>, document.body
  );
}
