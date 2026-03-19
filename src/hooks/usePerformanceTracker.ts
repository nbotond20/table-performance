import { useState, useCallback, useRef, useEffect } from 'react';
import type { PerformanceMetrics } from '../types/student';

const INITIAL_METRICS: PerformanceMetrics = {
  initialRender: null,
  lastSort: null,
  lastFilter: null,
  lastEdit: null,
  renderCount: 0,
  lastRenderTime: null,
};

export function usePerformanceTracker() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(INITIAL_METRICS);
  const marks = useRef<Map<string, number>>(new Map());

  // Render tracking — uses direct DOM updates to avoid extra renders
  const renderCountRef = useRef(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const renderCountElRef = useRef<HTMLSpanElement>(null);
  const renderTimeElRef = useRef<HTMLSpanElement>(null);
  const commitTimeRef = useRef(0);

  renderCountRef.current++;

  // After each commit, update render stats via DOM (zero extra renders)
  useEffect(() => {
    const now = performance.now();
    // Duration since last commit (approximates render cycle time)
    const duration = commitTimeRef.current ? now - commitTimeRef.current : 0;
    commitTimeRef.current = now;

    // Update DOM directly — no setState, no extra render
    if (renderCountElRef.current) {
      renderCountElRef.current.textContent = String(renderCountRef.current);
    }
    if (renderTimeElRef.current && duration > 0) {
      renderTimeElRef.current.textContent = `${duration.toFixed(1)} ms`;
    }

    // Flash the visualizer border
    const el = flashRef.current;
    if (el) {
      el.classList.remove('rerender-flash');
      void el.offsetWidth;
      el.classList.add('rerender-flash');
    }
  });

  const startMeasure = useCallback((label: string) => {
    marks.current.set(label, performance.now());
  }, []);

  const endMeasure = useCallback((label: keyof PerformanceMetrics) => {
    const start = marks.current.get(label);
    if (start == null) return;
    marks.current.delete(label);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const duration = performance.now() - start;
        setMetrics((prev) => ({ ...prev, [label]: duration }));
      });
    });
  }, []);

  const endMeasureSync = useCallback((label: keyof PerformanceMetrics) => {
    const start = marks.current.get(label);
    if (start == null) return;
    marks.current.delete(label);
    const duration = performance.now() - start;
    setMetrics((prev) => ({ ...prev, [label]: duration }));
  }, []);

  const setMetric = useCallback(
    (label: keyof PerformanceMetrics, value: number) => {
      setMetrics((prev) => ({ ...prev, [label]: value }));
    },
    [],
  );

  return {
    metrics,
    startMeasure,
    endMeasure,
    endMeasureSync,
    setMetric,
    flashRef,
    renderCountElRef,
    renderTimeElRef,
  };
}
