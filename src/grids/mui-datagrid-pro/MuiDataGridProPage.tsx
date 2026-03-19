import { useState, useEffect, useRef, useCallback } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  DataGridPro,
  Toolbar,
  QuickFilter,
  QuickFilterControl,
  type GridColDef,
  type GridRenderCellParams,
  type GridRenderEditCellParams,
} from '@mui/x-data-grid-pro';
import type { StudentRow, Grade, Status } from '../../types/student';
import { EXERCISE_KEYS, GRADES, STATUSES } from '../../types/student';
import { students, computeAggregates } from '../../data/generateStudents';
import { mockDbSave } from '../../data/mockDb';
import { usePerformanceTracker } from '../../hooks/usePerformanceTracker';
import { PerformancePanel } from '../../components/PerformancePanel';
import './MuiDataGridProPage.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#11111b', paper: '#1e1e2e' },
    primary: { main: '#89b4fa' },
  },
});

// --- Status icon renderer ---
const STATUS_CONFIG: Record<Status, { icon: string; color: string }> = {
  Active: { icon: '\u25CF', color: '#a6e3a1' },
  Inactive: { icon: '\u25CF', color: '#f38ba8' },
  Graduated: { icon: '\u25CF', color: '#89b4fa' },
};

function renderStatus(params: GridRenderCellParams<StudentRow, Status>) {
  const cfg = STATUS_CONFIG[params.value!];
  return (
    <span className="status-cell">
      <span style={{ color: cfg.color }}>{cfg.icon}</span> {params.value}
    </span>
  );
}

function renderEditStatus(params: GridRenderEditCellParams) {
  return (
    <select
      className="grid-select"
      value={params.value as string}
      autoFocus
      onChange={(e) => params.api.setEditCellValue({ id: params.id, field: params.field, value: e.target.value })}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// --- Grade select renderer ---
const GRADE_COLORS: Record<Grade, string> = {
  A: '#a6e3a1', B: '#89b4fa', C: '#f9e2af', D: '#fab387', F: '#f38ba8',
};

function renderGrade(params: GridRenderCellParams<StudentRow, Grade>) {
  return (
    <span className="grade-badge" style={{ background: GRADE_COLORS[params.value!] }}>
      {params.value}
    </span>
  );
}

function renderEditGrade(params: GridRenderEditCellParams) {
  return (
    <select
      className="grid-select"
      value={params.value as string}
      autoFocus
      onChange={(e) => params.api.setEditCellValue({ id: params.id, field: params.field, value: e.target.value })}
    >
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}

// --- Progress bar renderer for scores ---
function renderScore(params: GridRenderCellParams<StudentRow, number>) {
  const v = params.value ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${v}%`, background: color }} />
      <span className="score-text">{v}</span>
    </div>
  );
}

// --- Pass rate progress renderer ---
function renderPassRate(params: GridRenderCellParams<StudentRow, number>) {
  const v = params.value ?? 0;
  const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
  return (
    <div className="score-cell">
      <div className="score-bar" style={{ width: `${v}%`, background: color }} />
      <span className="score-text">{v}%</span>
    </div>
  );
}

// --- Column definitions ---
const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', width: 180, editable: true },
  { field: 'email', headerName: 'Email', width: 260, editable: true, getApplyQuickFilterFn: () => null },
  { field: 'age', headerName: 'Age', width: 70, type: 'number', editable: true, getApplyQuickFilterFn: () => null },
  {
    field: 'grade', headerName: 'Grade', width: 80, editable: true,
    renderCell: renderGrade, renderEditCell: renderEditGrade,
    getApplyQuickFilterFn: () => null,
  },
  {
    field: 'status', headerName: 'Status', width: 120, editable: true,
    renderCell: renderStatus, renderEditCell: renderEditStatus,
    getApplyQuickFilterFn: () => null,
  },
  { field: 'enrollmentDate', headerName: 'Enrolled', width: 120, editable: true, getApplyQuickFilterFn: () => null },
  // Exercise scores with progress bars
  ...EXERCISE_KEYS.map(
    (key, i): GridColDef => ({
      field: key,
      headerName: `Ex ${i + 1}`,
      width: 90,
      type: 'number',
      editable: true,
      renderCell: renderScore,
      getApplyQuickFilterFn: () => null,
    }),
  ),
  // Aggregates (readonly)
  { field: 'avgScore', headerName: 'Avg', width: 80, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'minScore', headerName: 'Min', width: 70, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'maxScore', headerName: 'Max', width: 70, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'totalPoints', headerName: 'Total', width: 80, type: 'number', getApplyQuickFilterFn: () => null },
  { field: 'passRate', headerName: 'Pass %', width: 90, renderCell: renderPassRate, getApplyQuickFilterFn: () => null },
];

function CustomToolbar() {
  return (
    <Toolbar>
      <QuickFilter>
        <QuickFilterControl placeholder="Search student names..." />
      </QuickFilter>
    </Toolbar>
  );
}

const slotsConfig = { toolbar: CustomToolbar } as const;

export default function MuiDataGridProPage() {
  const [rows, setRows] = useState<StudentRow[]>(() => [...students]);
  const {
    metrics, startMeasure, endMeasure, endMeasureSync, setMetric,
    flashRef, renderCountElRef, renderTimeElRef,
  } = usePerformanceTracker();

  // Initial render timing
  const mountTime = useRef(0);
  const initialMeasured = useRef(false);
  useEffect(() => {
    if (!mountTime.current) mountTime.current = performance.now();
    if (initialMeasured.current) return;
    initialMeasured.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMetric('initialRender', performance.now() - mountTime.current);
      });
    });
  }, [setMetric]);

  const processRowUpdate = useCallback(
    async (newRow: StudentRow, oldRow: StudentRow) => {
      startMeasure('lastEdit');

      // Recompute aggregates if an exercise score changed
      const changedField = Object.keys(newRow).find(
        (k) => newRow[k as keyof StudentRow] !== oldRow[k as keyof StudentRow],
      );
      if (changedField?.startsWith('ex')) {
        computeAggregates(newRow);
      }

      // Optimistic update
      setRows((prev) => prev.map((r) => (r.id === newRow.id ? newRow : r)));

      try {
        if (changedField) {
          await mockDbSave(newRow.id, changedField, newRow[changedField as keyof StudentRow]);
        }
        endMeasureSync('lastEdit');
        return newRow;
      } catch (err) {
        console.error('[MUI] Save failed, reverting:', err);
        setRows((prev) => prev.map((r) => (r.id === oldRow.id ? oldRow : r)));
        endMeasureSync('lastEdit');
        return oldRow;
      }
    },
    [startMeasure, endMeasureSync],
  );

  const handleSortModelChange = useCallback(() => {
    startMeasure('lastSort');
    requestAnimationFrame(() => endMeasure('lastSort'));
  }, [startMeasure, endMeasure]);

  const handleFilterModelChange = useCallback(() => {
    startMeasure('lastFilter');
    requestAnimationFrame(() => endMeasure('lastFilter'));
  }, [startMeasure, endMeasure]);

  const handleProcessRowUpdateError = useCallback((err: unknown) => console.error(err), []);
  const getRowId = useCallback((row: StudentRow) => row.id, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="mui-grid-page">
        <PerformancePanel
          metrics={metrics}
          gridName="MUI DataGrid Pro"
          flashRef={flashRef}
          renderCountElRef={renderCountElRef}
          renderTimeElRef={renderTimeElRef}
        />
        <div className="mui-grid-container">
          <DataGridPro
            rows={rows}
            columns={columns}
            checkboxSelection
            disableRowSelectionOnClick
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={handleProcessRowUpdateError}
            onSortModelChange={handleSortModelChange}
            onFilterModelChange={handleFilterModelChange}
            slots={slotsConfig}
            getRowId={getRowId}
            rowHeight={35}
            columnHeaderHeight={40}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
