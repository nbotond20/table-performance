import type { RefObject } from 'react';
import type { PerformanceMetrics } from '../types/student';
import './PerformancePanel.css';

interface Props {
  metrics: PerformanceMetrics;
  gridName: string;
  flashRef: RefObject<HTMLDivElement | null>;
  renderCountElRef: RefObject<HTMLSpanElement | null>;
  renderTimeElRef: RefObject<HTMLSpanElement | null>;
}

function fmt(value: number | null): string {
  if (value == null) return '---';
  return `${value.toFixed(1)} ms`;
}

export function PerformancePanel({
  metrics,
  gridName,
  flashRef,
  renderCountElRef,
  renderTimeElRef,
}: Props) {
  return (
    <aside className="perf-panel" ref={flashRef}>
      <h3>{gridName} — Performance</h3>
      <div className="perf-grid">
        <div className="perf-metric">
          <span className="perf-label">Initial Render</span>
          <span className="perf-value">{fmt(metrics.initialRender)}</span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Last Sort</span>
          <span className="perf-value">{fmt(metrics.lastSort)}</span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Last Filter</span>
          <span className="perf-value">{fmt(metrics.lastFilter)}</span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Last Edit</span>
          <span className="perf-value">{fmt(metrics.lastEdit)}</span>
        </div>
        <div className="perf-metric perf-metric--render">
          <span className="perf-label">Renders</span>
          <span className="perf-value perf-value--render" ref={renderCountElRef}>
            0
          </span>
        </div>
        <div className="perf-metric perf-metric--render">
          <span className="perf-label">Last Render</span>
          <span className="perf-value perf-value--render" ref={renderTimeElRef}>
            ---
          </span>
        </div>
      </div>
    </aside>
  );
}
