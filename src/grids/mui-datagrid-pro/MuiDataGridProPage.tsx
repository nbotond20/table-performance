import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  DataGridPro,
  type GridColDef,
  type GridRenderCellParams,
  type GridRenderEditCellParams,
  type GridRowSelectionModel,
  type GridRowParams,
  type GridPinnedColumnFields,
  useGridApiRef,
  type GridCellParams,
} from '@mui/x-data-grid-pro';
import type { StudentRow, Grade, Status } from '../../types/student';
import { EXERCISE_KEYS, GRADES, STATUSES } from '../../types/student';
import { getStudents, computeAggregates } from '../../data/generateStudents';
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
    <select className="grid-select" value={params.value as string} autoFocus
      onChange={(e) => params.api.setEditCellValue({ id: params.id, field: params.field, value: e.target.value })}>
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
    <select className="grid-select" value={params.value as string} autoFocus
      onChange={(e) => params.api.setEditCellValue({ id: params.id, field: params.field, value: e.target.value })}>
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

// --- Detail panel for row expansion ---
function DetailPanel({ row }: { row: GridRowParams<StudentRow> }) {
  const student = row.row;
  return (
    <div className="detail-panel">
      <div className="detail-info">
        <h4>{student.name}</h4>
        <p>{student.email} &middot; Age {student.age} &middot; {student.status} &middot; Enrolled {student.enrollmentDate}</p>
      </div>
      <div className="detail-scores">
        <span className="detail-label">Exercise Scores</span>
        <div className="detail-bars">
          {EXERCISE_KEYS.map((key, i) => {
            const v = student[key] as number;
            const color = v >= 80 ? '#a6e3a1' : v >= 50 ? '#f9e2af' : '#f38ba8';
            return (
              <div key={key} className="detail-bar-item">
                <span className="detail-bar-label">{i + 1}</span>
                <div className="detail-bar-track">
                  <div className="detail-bar-fill" style={{ width: `${v}%`, background: color }} />
                </div>
                <span className="detail-bar-value">{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Column definitions (resizable by default in Pro) ---
const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', width: 180, editable: true },
  { field: 'email', headerName: 'Email', width: 260, editable: true, getApplyQuickFilterFn: () => null },
  { field: 'age', headerName: 'Age', width: 70, type: 'number', editable: true, getApplyQuickFilterFn: () => null },
  {
    field: 'grade', headerName: 'Grade', width: 80, editable: true,
    renderCell: renderGrade, renderEditCell: renderEditGrade, getApplyQuickFilterFn: () => null,
  },
  {
    field: 'status', headerName: 'Status', width: 120, editable: true,
    renderCell: renderStatus, renderEditCell: renderEditStatus, getApplyQuickFilterFn: () => null,
  },
  { field: 'enrollmentDate', headerName: 'Enrolled', width: 120, editable: true, getApplyQuickFilterFn: () => null },
  ...EXERCISE_KEYS.map(
    (key, i): GridColDef => ({
      field: key, headerName: `Ex ${i + 1}`, width: 90, type: 'number',
      editable: true, renderCell: renderScore, getApplyQuickFilterFn: () => null,
    }),
  ),
  { field: 'avgScore', headerName: 'Avg', width: 80, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'minScore', headerName: 'Min', width: 70, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'maxScore', headerName: 'Max', width: 70, type: 'number', renderCell: renderScore, getApplyQuickFilterFn: () => null },
  { field: 'totalPoints', headerName: 'Total', width: 80, type: 'number', getApplyQuickFilterFn: () => null },
  { field: 'passRate', headerName: 'Pass %', width: 90, renderCell: renderPassRate, getApplyQuickFilterFn: () => null },
];

// --- Editable field order for Tab/Enter navigation ---
const EDITABLE_FIELDS = columns.filter((c) => c.editable).map((c) => c.field);

// --- Initial pinned columns ---
const INITIAL_PINNED: GridPinnedColumnFields = {
  left: ['__check__', '__detail_panel_toggle__', 'name'],
  right: ['avgScore', 'passRate'],
};

export default function MuiDataGridProPage({ rowCount }: { rowCount: number }) {
  const apiRef = useGridApiRef();
  const students = useMemo(() => getStudents(rowCount), [rowCount]);
  const [rows, setRows] = useState<StudentRow[]>(() => [...students]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [bulkGrade, setBulkGrade] = useState<Grade>('A');
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

  const selectedCount = selectionModel.type === 'include'
    ? selectionModel.ids.size
    : rows.length - selectionModel.ids.size;

  // --- Bulk edit: set grade for all selected rows ---
  const handleBulkGradeChange = useCallback(() => {
    if (selectedCount === 0) return;
    const { type, ids } = selectionModel;
    startMeasure('lastEdit');
    setRows((prev) =>
      prev.map((r) => {
        if (r.grade === bulkGrade) return r;
        const isSelected = type === 'include' ? ids.has(r.id) : !ids.has(r.id);
        if (!isSelected) return r;
        return { ...r, grade: bulkGrade };
      }),
    );
    endMeasureSync('lastEdit');
  }, [selectionModel, selectedCount, bulkGrade, startMeasure, endMeasureSync]);

  const processRowUpdate = useCallback(
    (newRow: StudentRow, oldRow: StudentRow) => {
      startMeasure('lastEdit');
      const changedField = Object.keys(newRow).find(
        (k) => newRow[k as keyof StudentRow] !== oldRow[k as keyof StudentRow],
      );
      if (changedField?.startsWith('ex')) {
        computeAggregates(newRow);
      }
      setRows((prev) => prev.map((r) => (r.id === newRow.id ? newRow : r)));
      if (changedField) {
        mockDbSave(newRow.id, changedField, newRow[changedField as keyof StudentRow]).then(
          () => endMeasureSync('lastEdit'),
          (err) => {
            console.error('[MUI] Save failed, reverting:', err);
            setRows((prev) => prev.map((r) => (r.id === oldRow.id ? oldRow : r)));
            endMeasureSync('lastEdit');
          },
        );
      } else {
        endMeasureSync('lastEdit');
      }
      return newRow;
    },
    [startMeasure, endMeasureSync],
  );

  // Single-click to enter edit mode
  const handleCellClick = useCallback(
    (params: GridCellParams) => {
      if (params.isEditable && params.cellMode !== 'edit') {
        apiRef.current?.startCellEditMode({ id: params.id, field: params.field });
      }
    },
    [apiRef],
  );

  // Tab/Enter navigate to next editable cell in the row
  const handleCellKeyDown = useCallback(
    (params: GridCellParams, event: React.KeyboardEvent) => {
      if (params.cellMode !== 'edit') return;
      if (event.key !== 'Tab' && event.key !== 'Enter') return;

      event.preventDefault();
      event.stopPropagation();
      const currentIdx = EDITABLE_FIELDS.indexOf(params.field);
      const nextField = currentIdx < EDITABLE_FIELDS.length - 1 ? EDITABLE_FIELDS[currentIdx + 1] : null;
      apiRef.current?.stopCellEditMode({ id: params.id, field: params.field });
      if (nextField) {
        setTimeout(() => apiRef.current?.startCellEditMode({ id: params.id, field: nextField }), 0);
      }
    },
    [apiRef],
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
  const getDetailPanelContent = useCallback((params: GridRowParams<StudentRow>) => <DetailPanel row={params} />, []);
  const getDetailPanelHeight = useCallback(() => 'auto' as const, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="mui-grid-page">
        <PerformancePanel
          metrics={metrics} gridName="MUI DataGrid Pro"
          flashRef={flashRef} renderCountElRef={renderCountElRef} renderTimeElRef={renderTimeElRef}
        />
        <div className="bulk-toolbar">
          {selectedCount > 0 && (
            <div className="bulk-actions">
              <span className="bulk-count">{selectedCount} selected</span>
              <select className="bulk-select" value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value as Grade)}>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <button className="bulk-btn" onClick={handleBulkGradeChange}>Set Grade</button>
            </div>
          )}
          <span className="sort-hint">Shift+Click headers for multi-sort</span>
        </div>
        <div className="mui-grid-container">
          <DataGridPro
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={setSelectionModel}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={handleProcessRowUpdateError}
            onSortModelChange={handleSortModelChange}
            onFilterModelChange={handleFilterModelChange}
            onCellClick={handleCellClick}
            onCellKeyDown={handleCellKeyDown}
            pinnedColumns={INITIAL_PINNED}
            getDetailPanelContent={getDetailPanelContent}
            getDetailPanelHeight={getDetailPanelHeight}
            showToolbar
            getRowId={getRowId}
            rowHeight={35}
            columnHeaderHeight={40}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
