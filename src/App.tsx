import { useState, Suspense, lazy } from 'react';
import './App.css';

interface GridTestCase {
  id: string;
  label: string;
  Component: React.LazyExoticComponent<React.ComponentType>;
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
];

export default function App() {
  const [activeId, setActiveId] = useState(gridTestCases[0].id);
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
      </header>
      <main className="app-main">
        <Suspense fallback={<div className="loading">Loading grid...</div>}>
          <active.Component key={active.id} />
        </Suspense>
      </main>
    </div>
  );
}
