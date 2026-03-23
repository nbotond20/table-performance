import { useState, Suspense, lazy } from 'react';
import { ROW_COUNT_OPTIONS } from './data/generateStudents';
import './App.css';

interface GridTestCase {
  id: string;
  label: string;
  Component: React.LazyExoticComponent<React.ComponentType<{ rowCount: number; virtualized: boolean }>>;
}

// --- Registry: add new grid test cases here ---
const gridTestCases: GridTestCase[] = [
  {
    id: 'mui-datagrid-pro',
    label: 'MUI DataGrid Pro',
    Component: lazy(() => import('./grids/mui-datagrid-pro/MuiDataGridProPage')),
  },
  {
    id: 'tanstack-table',
    label: 'TanStack Table',
    Component: lazy(() => import('./grids/tanstack-table/TanStackTablePage')),
  },
  {
    id: 'react-data-grid',
    label: 'React Data Grid',
    Component: lazy(() => import('./grids/react-data-grid/ReactDataGridPage')),
  },
];

export default function App() {
  const [activeId, setActiveId] = useState(gridTestCases[0].id);
  const [virtualized, setVirtualized] = useState(() => {
    return localStorage.getItem('virtualized') !== 'false';
  });
  const [rowCount, setRowCount] = useState(() => {
    const saved = localStorage.getItem('rowCount');
    const parsed = saved ? Number(saved) : NaN;
    return ROW_COUNT_OPTIONS.includes(parsed as typeof ROW_COUNT_OPTIONS[number]) ? parsed : 10_000;
  });

  const handleRowCountChange = (value: number) => {
    setRowCount(value);
    localStorage.setItem('rowCount', String(value));
  };
  const handleVirtualizedChange = (checked: boolean) => {
    setVirtualized(checked);
    localStorage.setItem('virtualized', String(checked));
  };
  const active = gridTestCases.find((tc) => tc.id === activeId)!;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Data Grid Benchmark</h1>
        <nav className="tab-bar">
          {gridTestCases.map((tc) => (
            <button
              key={tc.id}
              className={tc.id === activeId ? 'active' : ''}
              onClick={() => setActiveId(tc.id)}
            >
              {tc.label}
            </button>
          ))}
        </nav>
        <div className="row-count-config">
          <label htmlFor="row-count">Rows:</label>
          <select
            id="row-count"
            value={rowCount}
            onChange={(e) => handleRowCountChange(Number(e.target.value))}
          >
            {ROW_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <label className="virtualization-toggle">
          <input
            type="checkbox"
            checked={virtualized}
            onChange={(e) => handleVirtualizedChange(e.target.checked)}
          />
          Virtualization
        </label>
      </header>
      <main className="app-main">
        <Suspense fallback={<div className="loading">Loading grid...</div>}>
          <active.Component key={`${active.id}-${rowCount}-${virtualized}`} rowCount={rowCount} virtualized={virtualized} />
        </Suspense>
      </main>
    </div>
  );
}
