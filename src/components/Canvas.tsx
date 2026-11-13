import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface CanvasHandle {
  fit: () => void;
}

interface Props {
  contentWidth: number;
  contentHeight: number;
  children: React.ReactNode;
  onBackgroundClick?: () => void;
}

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.1;
const MAX_K = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { contentWidth, contentHeight, children, onBackgroundClick },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const hasFitted = useRef(false);
  /** A fit was requested while the canvas had no usable size (hidden tab, still laying out). */
  const fitPending = useRef(false);

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host || !contentWidth || !contentHeight) return;
    const { clientWidth: w, clientHeight: h } = host;
    if (w < 120 || h < 120) {
      fitPending.current = true;
      return;
    }
    fitPending.current = false;
    const k = clamp(Math.min((w - 48) / contentWidth, (h - 48) / contentHeight, 1.25), MIN_K, MAX_K);
    setView({ k, x: (w - contentWidth * k) / 2, y: (h - contentHeight * k) / 2 });
  }, [contentWidth, contentHeight]);

  useImperativeHandle(ref, () => ({ fit }), [fit]);

  useEffect(() => {
    if (!hasFitted.current && contentWidth > 0) {
      hasFitted.current = true;
      fit();
    }
  }, [contentWidth, fit]);

  // Finish a deferred fit as soon as the canvas gets a real size.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      if (fitPending.current) fit();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);

  // Wheel must be non-passive so we can preventDefault page zoom/scroll.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-zoom on trackpads arrives as ctrl+wheel.
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 3) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  // Suppress the click that ends a pan so nodes don't get selected.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragMoved.current) {
      e.stopPropagation();
      dragMoved.current = false;
    }
  };
  const dragMoved = useRef(false);
  const onPointerUpCapture = () => {
    dragMoved.current = !!drag.current?.moved;
  };

  const center = () => {
    const host = hostRef.current!;
    return [host.clientWidth / 2, host.clientHeight / 2] as const;
  };

  const grid = 22 * view.k;

  return (
    <div
      ref={hostRef}
      className="canvas"
      style={
        {
          // Each UI direction draws its own grid from these variables.
          '--grid': `${grid}px`,
          '--ox': `${view.x}px`,
          '--oy': `${view.y}px`,
          cursor: drag.current?.moved ? 'grabbing' : 'grab',
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onClick={onBackgroundClick}
    >
      <div
        className="canvas-content"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {children}
      </div>
      <div className="zoom-controls" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2, ...center())}>
          −
        </button>
        <button className="zoom-pct" title="Reset to 100%" onClick={() => zoomAt(1 / view.k, ...center())}>
          {Math.round(view.k * 100)}%
        </button>
        <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomAt(1.2, ...center())}>
          +
        </button>
        <span className="zoom-sep" />
        <button title="Fit to screen (⇧1)" onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
});
